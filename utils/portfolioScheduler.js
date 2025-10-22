const cron = require('node-cron');
const Portfolio = require('../models/Portfolio');
const Notification = require('../models/Notification');

// Function to update portfolio values based on admin-set return rates
const updatePortfolioValues = async () => {
  try {
    console.log('Starting daily portfolio update...');
    
    // Find all portfolios that have admin-set return rates
    const portfolios = await Portfolio.find({
      'plans.adminSetReturnRate': { $exists: true, $ne: null }
    });

    let updatedCount = 0;

    for (const portfolio of portfolios) {
      let portfolioUpdated = false;

      // Update each plan that has an admin-set return rate
      for (let i = 0; i < portfolio.plans.length; i++) {
        const plan = portfolio.plans[i];
        
        if (plan.adminSetReturnRate && plan.invested > 0) {
          // Calculate daily return (admin-set percentage / 100 for daily rate)
          // For example: 7% annual = 7/365 = 0.019% daily
          const dailyReturnRate = plan.adminSetReturnRate / 365;
          const dailyReturn = plan.invested * (dailyReturnRate / 100);
          
          // Update current value
          const newCurrentValue = plan.currentValue + dailyReturn;
          portfolio.plans[i].currentValue = newCurrentValue;
          portfolio.plans[i].returns = newCurrentValue - plan.invested;
          
          // Update last daily update timestamp
          portfolio.plans[i].lastDailyUpdate = new Date();
          
          // Add to price history
          if (!portfolio.plans[i].priceHistory) {
            portfolio.plans[i].priceHistory = [];
          }
          portfolio.plans[i].priceHistory.push({
            value: newCurrentValue,
            updatedAt: new Date()
          });
          
          portfolioUpdated = true;
        }
      }

      if (portfolioUpdated) {
        // Recalculate portfolio totals
        portfolio.totalInvested = portfolio.plans.reduce((sum, p) => sum + (p.invested || 0), 0);
        portfolio.currentValue = portfolio.plans.reduce((sum, p) => sum + (p.currentValue || 0), 0) + (portfolio.referralRewards || 0);
        portfolio.totalReturns = portfolio.currentValue - portfolio.totalInvested;
        portfolio.totalReturnsPercentage = portfolio.totalInvested > 0
          ? (portfolio.totalReturns / portfolio.totalInvested) * 100
          : 0;

        await portfolio.save();
        updatedCount++;

        // Create notification for user about portfolio update
        try {
          await Notification.create({
            userId: portfolio.user,
            message: `Your portfolio has been updated with daily returns. Current value: $${portfolio.currentValue.toFixed(2)}`,
            type: 'portfolio_update',
            read: false
          });
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }
    }

    console.log(`Daily portfolio update completed. Updated ${updatedCount} portfolios.`);
  } catch (error) {
    console.error('Error in daily portfolio update:', error);
  }
};

// Schedule the portfolio update to run daily at 12:00 AM
const startPortfolioScheduler = () => {
  console.log('Starting portfolio scheduler...');
  
  // Run daily at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled portfolio update...');
    await updatePortfolioValues();
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  // For testing purposes, also run every 5 minutes (remove in production)
  // cron.schedule('*/5 * * * *', async () => {
  //   console.log('Running test portfolio update...');
  //   await updatePortfolioValues();
  // }, {
  //   scheduled: true,
  //   timezone: "UTC"
  // });

  console.log('Portfolio scheduler started successfully');
};

// Manual trigger for testing
const triggerPortfolioUpdate = async () => {
  console.log('Manually triggering portfolio update...');
  await updatePortfolioValues();
};

module.exports = {
  startPortfolioScheduler,
  updatePortfolioValues,
  triggerPortfolioUpdate
};
