const express = require("express");
const router = express.Router();

const serveFormPage = require("../controllers/serveFormPage");
const serveQPage = require("../controllers/serveQPage");
const checkStatusHandler = require("../controllers/checkStatusHandler");
const getMyInfoEnvHandler = require("../controllers/getMyInfoEnvHandler");
const getPersonDataHandler = require("../controllers/getPersonDataHandler");
const submitDataHandler = require("../controllers/submitDataHandler");
const callSafeEntryHandler = require("../controllers/callSafeEntryHandler");
const callNumberHandler = require("../controllers/callNumberHandler");

//Pages
router.get("/form", serveFormPage);
router.get("/callback", serveFormPage);
router.get("/queue", serveQPage);

//API (Browser facing)
router.get("/checkStatus/:venueId/:nric/:number", checkStatusHandler);
router.get("/myInfoEnv", getMyInfoEnvHandler);
router.post("/person", getPersonDataHandler);
router.post("/submit", submitDataHandler);
router.post("/safeEntry", callSafeEntryHandler);

//API (Clinic facing)
router.post("/callNumber", callNumberHandler);

module.exports = router;
