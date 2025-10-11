const express = require("express"); 
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");
const { createInvestmentRequest, getInvestmentRequests, getInvestmentRequestById } = require("../controller/investmentReq-controlller");

router.post("/create", authenticateUser, createInvestmentRequest);
router.get("/", authenticateUser, getInvestmentRequests);
router.get("/:id", authenticateUser, getInvestmentRequestById);

module.exports = router;