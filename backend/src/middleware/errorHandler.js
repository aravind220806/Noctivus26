export function errorHandler(error, _request, response, _next) {
  console.error(error);
  response.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'An unexpected server error occurred.' });
}
