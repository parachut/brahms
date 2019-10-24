import Geocodio from 'geocodio';
import forIn from 'lodash/forIn';
import util from 'util';

import { Address } from '../models/Address';
import { CensusData } from '../models/CensusData';
import { CensusRangeBlock } from '../models/CensusRangeBlock';

const geocodio = new Geocodio({
  api_key: process.env.GEOCODIO,
});

const geocodioPromise = util.promisify(geocodio.get).bind(geocodio);

async function updateAddressCensusData(job) {
  const { addressId } = job.data;

  if (addressId) {
    const address = await Address.findByPk(addressId, {
      include: [
        {
          association: 'censusData',
        },
      ],
    });

    const response = await geocodioPromise('geocode', {
      q: address.formattedAddress,
      fields: !address.censusData ? 'census' : '',
    });

    let { results, input } = JSON.parse(response);
    let [result] = results;

    address.formattedStreet = result.address_components.formatted_street;
    address.formattedAddress = result.formatted_address;
    address.secondaryUnit = input.address_components.secondaryunit;
    address.secondaryNumber = input.address_components.secondarynumber;
    address.coordinates = {
      type: 'Point',
      coordinates: [result.location.lat, result.location.lng],
    };

    if (result.address_components.number) {
      address.formattedStreet =
        result.address_components.number + ' ' + address.formattedStreet;
    }

    if (address.secondaryUnit && address.secondaryNumber) {
      address.formattedStreet += ` ${address.secondaryUnit} ${address.secondaryNumber}`;
      const addSecondary = address.formattedAddress.split(', ');
      addSecondary[0] = address.formattedStreet;
      address.formattedAddress = addSecondary.join(', ');
    }

    await address.save();

    if (result.fields && result.fields.census) {
      const exists = await CensusData.findOne({
        where: {
          fips: result.fields.census.full_fips,
        },
      });

      if (exists) {
        address.censusDataId = exists.id;
        await address.save();
      } else {
        const censusData = await geocodioPromise('geocode', {
          q: address.formattedAddress,
          fields: 'acs-demographics,acs-economics,acs-housing,acs-social',
        });

        const { results: censusResults } = JSON.parse(censusData);

        const [censusResult] = censusResults;

        const populationTotal =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ].Total.value;

        const highSchoolGraduate =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Male: High school graduate (includes equivalency)'].percentage +
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Female: High school graduate (includes equivalency)'].percentage;

        const someCollege =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Male: Some college, 1 or more years, no degree'].percentage +
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Female: Some college, 1 or more years, no degree'].percentage;

        const collegeGraduate =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]["Male: Associate's degree"].percentage +
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]["Female: Associate's degree"].percentage;

        const mastersGraduate =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]["Male: Master's degree"].percentage +
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]["Female: Master's degree"].percentage;

        const professionalGraduate =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Male: Professional school degree'].percentage +
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Female: Professional school degree'].percentage;

        const doctorateGraduate =
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Male: Doctorate degree'].percentage +
          censusResult.fields.acs.social[
            'Population by minimum level of education'
          ]['Female: Doctorate degree'].percentage;

        const censusRecord = await CensusData.create({
          fips: result.fields.census.full_fips,
          populationTotal,
          medianAge: Math.round(
            censusResult.fields.acs.demographics['Median age'].Total.value,
          ),
          medianIncome: Math.round(
            censusResult.fields.acs.economics['Median household income'].Total
              .value,
          ),
          medianHouseValue: Math.round(
            censusResult.fields.acs.housing[
              'Median value of owner-occupied housing units'
            ].Total.value,
          ),
          vacantHousing: Math.round(
            censusResult.fields.acs.housing['Occupancy status'].Vacant
              .percentage * 100,
          ),
          highSchoolGraduate: Math.round(highSchoolGraduate * 100),
          someCollege: Math.round(someCollege * 100),
          collegeGraduate: Math.round(collegeGraduate * 100),
          mastersGraduate: Math.round(mastersGraduate * 100),
          professionalGraduate: Math.round(professionalGraduate * 100),
          doctorateGraduate: Math.round(doctorateGraduate * 100),
        });

        address.censusDataId = censusRecord.get('id');
        await address.save();

        const ageRange =
          censusResult.fields.acs.demographics['Population by age range'];
        const ageRanges = [];

        forIn(ageRange, function(value, key) {
          const range = key.match(/\d+/g);

          if (range && range.length === 2) {
            const nRange = range.map((n) => Math.round(Number(n)));
            const existing = ageRanges.find((r) => r.range[0] === nRange[0]);
            if (!existing) {
              ageRanges.push({
                range: nRange,
                value: Math.round(value.percentage * 100),
                censusDataAgeId: censusRecord.get('id'),
              });
            } else {
              existing.value += Math.round(value.percentage * 100);
            }
          }
        });

        await CensusRangeBlock.bulkCreate(ageRanges);

        const incomeRange =
          censusResult.fields.acs.economics['Household income'];
        const incomeRanges = [];

        forIn(incomeRange, function(value, key) {
          const range = key.replace(/,/g, '').match(/\d+/g);

          if (range && range.length === 2) {
            const nRange = range.map((n) => Math.round(Number(n)));
            const existing = incomeRanges.find((r) => r.range[0] === nRange[0]);
            if (!existing) {
              incomeRanges.push({
                range: nRange,
                value: Math.round(value.percentage * 100),
                censusDataIncomeId: censusRecord.get('id'),
              });
            } else {
              existing.value += Math.round(value.percentage * 100);
            }
          }
        });

        await CensusRangeBlock.bulkCreate(incomeRanges);
      }
    }

    return address;
  }
}

export default updateAddressCensusData;
