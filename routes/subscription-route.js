const {Router} = require("express");
const { getDefaultPlans } = require("../controller/subscription-controller");

const router = Router();

router.get("/plan", getDefaultPlans);


module.exports = router

