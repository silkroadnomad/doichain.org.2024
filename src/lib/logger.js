const logger = {
  info: (message, ...optionalParams) => {
    console.info(message, ...optionalParams);
  },
  warn: (message, ...optionalParams) => {
    console.warn(message, ...optionalParams);
  },
  error: (message, ...optionalParams) => {
    console.error(message, ...optionalParams);
  },
  debug: (message, ...optionalParams) => {
    console.debug(message, ...optionalParams);
  }
};

export default logger;
