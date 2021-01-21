# Changelog
All notable changes to this project will be documented in this file.

## [2.2.0] 2021-01-21
### Added
- Send and receive attachments ([#8](https://github.com/gausma/nodered-contrib-signal-client/issues/8)).
- Sender and receiver numbers in the output nodes ([#10](https://github.com/gausma/nodered-contrib-signal-client/issues/10)).

## [2.1.0] 2021-01-14
### Added
- Send the receiver number in the message payload.

## [2.0.2] 2021-01-14
### Fixed
- Show error details in log and 2nd output ([#4](https://github.com/gausma/nodered-contrib-signal-client/issues/4)).
- Typos in help ([#6](https://github.com/gausma/nodered-contrib-signal-client/issues/6)).

## [2.0.1] 2021-01-11
### Fixed
- Docs.

## [2.0.0] 2021-01-10
### Changed
- Inject button for the registration nodes (input removed).
- Outputs for the registration nodes to signal success or errors.
- Sender node: input message interface extended for future data. Outputs to signal success or errors.
- Receiver node: Output message content extended. Outputs to signal success or errors.

### Added
- Example flows

## [1.3.1] 2021-01-04
### Fixed
- Message receiver management.

## [1.3.0] 2021-01-04
### Added
- Verbose Logging for send and receive.

## [1.2.0] 2021-01-03
### Added
- New node for registration via voice call.
- Save all account info in sub directory "signal" to avoid conflicts. Reregistration is neccessary.

## [1.1.0] 2020-12-31
### Added
 - Documentation.
 - Registration data is stored in the user settings directory.

## [1.0.0] 2020-12-30
### Added
 - Initial version.

**Note:** The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
