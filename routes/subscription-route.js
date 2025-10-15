const {Router} = require("express");
const { getDefaultPlans } = require("../controller/subscription-controller");
const { homeAnalytics } = require("../controller/analytics-controller");

const router = Router();

router.get("/plan", getDefaultPlans);
router.get("/home-analytics", homeAnalytics);


module.exports = router

