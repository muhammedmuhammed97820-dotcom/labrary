function errorHandler(error, req, res, next) {

  console.error(error);

  if (
    error.code === "LIMIT_FILE_SIZE"
  ) {

    return res.status(400).json({
      message:
        "Uploaded file is too large."
    });
  }

  res.status(500).json({
    message:
      error.message ||
      "Internal server error."
  });
}

module.exports = errorHandler;
