import express from 'express';
import Liana from 'forest-express-sequelize';
import fs from 'fs';
import stringify from 'csv-stringify';
import tmp from 'tmp';

import { Bin } from '../models/Bin';

const router = express.Router();

router.post(
  '/actions/generate-labels',
  Liana.ensureAuthenticated,
  async (req, res) => {
    const bins = await Bin.findAll({});

    const columns = {
      id: 'ID',
      location: 'Location',
    };

    const report = bins.map((bin) => ({
      id: bin.id,
      location: `${bin.location}-${bin.row}-${bin.column}-${bin.cell}`,
    }));

    stringify(
      report,
      {
        header: true,
        columns,
      },
      function(err, data) {
        if (err) {
          return res.status(500).send(err);
        }

        tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
          if (err) throw err;

          fs.writeFileSync(path, data);

          let options = {
            dotfiles: 'deny',
            headers: {
              'Access-Control-Expose-Headers': 'Content-Disposition',
              'Content-Disposition': 'attachment; filename="bins.csv"',
            },
          };

          res.sendFile(path, options, (error) => {
            if (error) {
              throw error;
            }
          });

          // If we don't need the file anymore we could manually call the cleanupCallback
          // But that is not necessary if we didn't pass the keep option because the library
          // will clean after itself.
          cleanupCallback();
        });
      },
    );
  },
);

module.exports = router;
