# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2020-04-05

### Changed

- Avoid modifing request objects too much. Now you can access root span under `req.gtrace` property. This is not a backward compatible chage.

## [1.0.4] - 2020-04-05

### Added

- Increased test coverage

## [1.0.3] - 2020-04-05

### Changed

- Added `http2` support

## [1.0.2] - 2020-04-05

### Changed

- Added `decorateRequest` function at the beginning to avoid the deoptimzation

## [1.0.1] - 2020-04-05

### Changed

- Added `decorateRequest` function at the beginning to avoid the deoptimzation

## [1.0.1] - 2020-04-05

### Added

- Added the following default labels: `HTTP_METHOD_LABEL_KEY`, `HTTP_RESPONSE_CODE_LABEL_KEY`, `HTTP_SOURCE_IP`, and `STATUS_CODE`
