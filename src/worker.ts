import Queue from "bull";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const maxJobsPerWorker = 25;

const checkClearbitFraudQueue = new Queue("check-clearbit-fraud", REDIS_URL);
const checkoutQueue = new Queue("checkout", REDIS_URL);
const createAuthyUserQueue = new Queue("create-authy-user", REDIS_URL);
const createEasyPostAddressQueue = new Queue(
  "create-easypost-address",
  REDIS_URL
);
const createFrontContactQueue = new Queue("create-front-contact", REDIS_URL);
const createStripeUserQueue = new Queue("create-stripe-user", REDIS_URL);
const runClearbitQueue = new Queue("run-clearbit", REDIS_URL);
const updateAddressCensusDataQueue = new Queue(
  "update-address-census-data",
  REDIS_URL
);
const updateProductStockQueue = new Queue("update-product-stock", REDIS_URL);
const updateUserGeolocationQueue = new Queue(
  "update-user-geolocation",
  REDIS_URL
);

checkClearbitFraudQueue.process(maxJobsPerWorker, "/tasks/checkClearbitFraud");
checkoutQueue.process(maxJobsPerWorker, "/tasks/checkout");
createAuthyUserQueue.process(maxJobsPerWorker, "/tasks/createAuthyUser");
createEasyPostAddressQueue.process(
  maxJobsPerWorker,
  "/tasks/createEasyPostAddress"
);
createFrontContactQueue.process(maxJobsPerWorker, "/tasks/createFrontContact");
createStripeUserQueue.process(maxJobsPerWorker, "/tasks/createStripeUser");
runClearbitQueue.process(maxJobsPerWorker, "/tasks/runClearbit");
updateAddressCensusDataQueue.process(
  maxJobsPerWorker,
  "/tasks/updateAddressCensusData"
);
updateProductStockQueue.process(maxJobsPerWorker, "/tasks/updateProductStock");
updateUserGeolocationQueue.process(
  maxJobsPerWorker,
  "/tasks/updateUserGeolocation"
);
