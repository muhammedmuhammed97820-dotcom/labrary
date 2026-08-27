const mongoose = require("mongoose");

async function connectDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/electronic_library";

    await mongoose.connect(mongoUri);

    console.log("==============================================");
    console.log("MongoDB connected");
    console.log("Database: electronic_library");
    console.log("==============================================");
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = connectDatabase;
