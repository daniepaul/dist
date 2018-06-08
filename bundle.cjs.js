'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var get = _interopDefault(require('lodash/get'));
var set = _interopDefault(require('lodash/set'));
var isEmpty = _interopDefault(require('lodash/isEmpty'));
var normalizr = require('normalizr');
var unionBy = _interopDefault(require('lodash/unionBy'));
var union = _interopDefault(require('lodash/union'));
var extend = _interopDefault(require('lodash/extend'));
var camelCase = _interopDefault(require('lodash/camelCase'));
var omit = _interopDefault(require('lodash/omit'));
var reduce = _interopDefault(require('lodash/reduce'));
var some = _interopDefault(require('lodash/some'));
var uniqueId = _interopDefault(require('lodash/uniqueId'));
var map = _interopDefault(require('lodash/map'));
var includes = _interopDefault(require('lodash/includes'));
var each = _interopDefault(require('lodash/each'));
var flatMap = _interopDefault(require('lodash/flatMap'));
var flow = _interopDefault(require('lodash/flow'));
require('isomorphic-fetch');
var assign = _interopDefault(require('lodash/assign'));
var join = _interopDefault(require('lodash/join'));
var pickBy = _interopDefault(require('lodash/pickBy'));

/**
 * Where our values are to be stored
 * @type {object}
 */
var storage = {};

/**
 * Gets a value out of storage
 * @param {number|string} key - the key to get from storage
 * @param {*} [defaultValue] - value to return if the key is not set
 * @returns {*} - the value from storage, if available
 */
function getValue(key, defaultValue) {
  return get(storage, key, defaultValue);
}

/**
 * Saves a value to storage
 * @param {number|string} key - the key to save the value with
 * @param {*} value - the value to save in storage
 * @returns {object} - storage Object
 */
function setValue(key, value) {
  return set(storage, key, value);
}

/**
 * Gets the saved execution key from storage
 * @returns {string} - the execution key
 */
var getExecutionKey = (function () {
  return getValue('execution');
});

/**
 * Saves the execution key from the response
 * @param {object} response - response from DC
 * @returns {boolean} - the execution key was saved
 */
var saveExecutionKey = (function (response) {
  var execution = response && response.headers ? response.headers.get('execution') : undefined;

  if (!isEmpty(execution)) {
    setValue('execution', execution);
    return true;
  }

  return false;
});

/**
 * Gets the NetworkLink instance from storage
 * @returns {NetworkLink} - the NetworkLink instance
 */
var getNetworkLink = (function () {
  return getValue('config').networkLink;
});

var ticketNumbers = new normalizr.schema.Entity('ticketNumbers', undefined, {
  idAttribute: 'number'
});

var tickets = new normalizr.schema.Entity('tickets', { ticketNumber: ticketNumbers }, {
  idAttribute: function idAttribute(value) {
    return get(value, 'ticketNumber.number', 'NA');
  },
  mergeStrategy: function mergeStrategy(entityA, entityB) {
    var ticketCoupon = unionBy(entityA.ticketCoupon, entityB.ticketCoupon, 'couponNumber');
    var paymentRefs = union(entityA.paymentRefs, entityB.paymentRefs);
    return extend({}, entityA, entityB, {
      ticketCoupon: ticketCoupon,
      paymentRefs: paymentRefs
    });
  }
});

var eligibilities = new normalizr.schema.Entity('eligibilities', undefined, {
  idAttribute: function idAttribute(value) {
    return get(value, 'reason[0].category', 'NA');
  }
});

var editCodes = new normalizr.schema.Entity('editCodes');

var airExtras = new normalizr.schema.Entity('airExtras');

var loyaltyAccounts = new normalizr.schema.Entity('loyaltyAccounts');

var flights = new normalizr.schema.Entity('flights');

var boardingPasses = new normalizr.schema.Entity('boardingPasses', {
  loyaltyAccount: loyaltyAccounts,
  flightDetail: flights,
  ticketNumber: ticketNumbers
}, {
  idAttribute: function idAttribute(value, parent) {
    return parent.id + '-bp';
  }
});

var passengerFlights = new normalizr.schema.Entity('passengerFlights', {
  eligibilities: { eligibility: [eligibilities] },
  boardingPass: boardingPasses
});

var passengerSegments = new normalizr.schema.Entity('passengerSegments', {
  editCodes: {
    editCode: [editCodes]
  },
  passengerFlight: [passengerFlights],
  airExtra: [airExtras],
  eligibilities: { eligibility: [eligibilities] },
  loyaltyAccount: loyaltyAccounts
});

var options = {
  idAttribute: function idAttribute(value, parent) {
    return parent.id;
  },
  processStrategy: function processStrategy(entity) {
    return extend({}, entity.document);
  }
};

var passports = new normalizr.schema.Entity('passports', undefined, options);
var nationalIds = new normalizr.schema.Entity('nationalIds', undefined, options);
// todo: add entity for all document types

var passengerDocuments = new normalizr.schema.Array({
  passports: passports,
  nationalIds: nationalIds
}, function (input) {
  return camelCase(get(input, 'document.type', 'unknown')) + 's';
});

var passengers = new normalizr.schema.Entity('passengers', {
  ticket: [tickets],
  eligibilities: { eligibility: [eligibilities] },
  passengerSegments: {
    passengerSegment: [passengerSegments]
  },
  airExtra: [airExtras],
  loyaltyAccount: [loyaltyAccounts],
  passengerDocument: passengerDocuments
});

var segments = new normalizr.schema.Entity('segments', {
  flights: [flights],
  eligibilities: { eligibility: [eligibilities] }
}, {
  processStrategy: function processStrategy(entity) {
    var newEntity = extend({}, entity, { flights: entity.flightDetail });
    return omit(newEntity, 'flightDetail');
  }
});

var itineraryParts = new normalizr.schema.Entity('itineraries', {
  segment: [segments],
  eligibilities: { eligibility: [eligibilities] },
  airExtra: [airExtras]
});

var reservation = new normalizr.schema.Entity('reservations', {
  passengers: { passenger: [passengers] },
  itinerary: {
    itineraryPart: [itineraryParts],
    eligibilities: { eligibility: [eligibilities] }
  },
  eligibilities: { eligibility: [eligibilities] },
  travelOrganizer: {
    loyaltyAccount: [loyaltyAccounts]
  }
});

var index = (function (input) {
  return normalizr.normalize(input, { reservation: reservation });
});

var seatColumns = new normalizr.schema.Entity('columns');

var seats = new normalizr.schema.Entity('seats', undefined, {
  idAttribute: 'number'
});

var seatFacilities = new normalizr.schema.Entity('facilities', undefined, {
  idAttribute: 'type'
});

var seatSlots = new normalizr.schema.Entity('slots', {
  seat: seats,
  facility: [seatFacilities]
}, {
  idAttribute: function idAttribute(entity, parent) {
    return parent.number + '-' + entity.columnRef;
  }
});

var seatRows = new normalizr.schema.Entity('rows', {
  slot: [seatSlots]
}, {
  idAttribute: 'number'
});

var seatCabins = new normalizr.schema.Entity('cabins', {
  column: [seatColumns],
  row: [seatRows]
}, {
  idAttribute: 'bookingClass',
  processStrategy: function processStrategy(entity) {
    var rowHaveWing = false;
    var rows = map(entity.row, function (row, index) {
      var rowExtra = { isFacilityRow: false };
      if (row && !row.number) {
        rowExtra.number = uniqueId('facility_');
        rowExtra.isFacilityRow = true;
      }
      if (row.characteristic && includes(row.characteristic, 'WING')) {
        rowExtra.isWing = true;
        if (!rowHaveWing && index !== 0) {
          rowExtra.isWingBegin = true;
        }
        rowHaveWing = true;
      } else if (rowHaveWing && rowExtra.isFacilityRow) {
        rowExtra.isWing = true;
      } else if (rowHaveWing) {
        set(entity, 'row[' + (index - 1) + '].isWingEnd', true);
        rowHaveWing = false;
      }
      return extend(row, rowExtra);
    });

    var columns = reduce(entity.column, function (memo, column, columnIndex) {
      if (column) {
        var addAisle = false;
        if (some(column.characteristic, { value: 'AISLE', location: 'RIGHT' })) {
          set(column, 'isNextToAisle', true);
          set(column, 'isAisleOnRight', true);
          addAisle = true;
        } else if (some(column.characteristic, { value: 'AISLE', location: 'LEFT' })) {
          set(column, 'isNextToAisle', true);
          set(column, 'isAisleOnLeft', true);
        } else if (some(column.characteristic, { value: 'WINDOW' })) {
          set(column, 'isNextToWindow', true);
        }

        if ((columnIndex === 0 || columnIndex === entity.column.length - 1) && !column.isNextToWindow) {
          set(column, 'isNextToWindow', true);
        }

        memo.push(column);
        if (addAisle) {
          memo.push({
            id: column.id + '_AISLE',
            isAisle: true,
            name: 'AISLE'
          });
        }
      }

      return memo;
    }, []);
    return extend({}, entity, { column: columns, row: rows });
  }
});

var seatPassengers = new normalizr.schema.Entity('seatPassengers', {
  passenger: passengers
});

var seatSegments = new normalizr.schema.Entity('segments');

var seatPrices = new normalizr.schema.Entity('prices');

var passengerSeatDetail = new normalizr.schema.Entity('passengerSeatDetails', undefined, {
  idAttribute: 'passengerRef'
});

/**
 * Transformer Function.
 *
 * Function to create a empty seatDetail object.
 * @access private
 * @returns {object}
 */
var createDefaultpassengerSeatDetail = function createDefaultpassengerSeatDetail() {
  return {
    priceRefs: undefined,
    seatFeeWaivers: [],
    seatEntitlements: [],
    isEntitled: true,
    isFeeWaived: false
  };
};

/**
 * Transformer Function.
 *
 * Transforms the passengerSeatDetail for enhanced seatmap to a seat entity map.
 * @param {object} entity - passengerSeatDetail entity with seatPrice, seatFeeWaiver and seatEntitlement
 * @returns {object}
 */
var transformPassengerSeatDetail = function transformPassengerSeatDetail(entity) {
  if (!entity) {
    return entity;
  }

  return reduce(entity.passengerSeatDetail, function (memo, passengerSeatDetail) {
    var seatDetails = {};
    reduce(passengerSeatDetail.seatPrice, function (priceMemo, seatPrice) {
      each(seatPrice.value, function (value) {
        if (!priceMemo[value]) {
          set(priceMemo, [value], createDefaultpassengerSeatDetail());
        }
        set(priceMemo, [value, 'priceRefs'], seatPrice.priceRef);
        return priceMemo;
      });
      return priceMemo;
    }, seatDetails);

    reduce(passengerSeatDetail.seatFeeWaiver, function (priceMemo, seatFeeWaiver) {
      each(seatFeeWaiver.value, function (value) {
        if (!priceMemo[value]) {
          set(priceMemo, [value], createDefaultpassengerSeatDetail());
        }
        set(priceMemo, [value, 'isFeeWaived'], priceMemo[value].isFeeWaived || seatFeeWaiver.waived);
        priceMemo[value].seatFeeWaivers.push(seatFeeWaiver.ruleId);
        return priceMemo;
      });
      return priceMemo;
    }, seatDetails);

    reduce(passengerSeatDetail.seatEntitlement, function (priceMemo, seatEntitlement) {
      each(seatEntitlement.value, function (value) {
        if (!priceMemo[value]) {
          set(priceMemo, [value], createDefaultpassengerSeatDetail());
        }
        set(priceMemo, [value, 'isEntitled'], priceMemo[value].isEntitled && seatEntitlement.entitled);
        priceMemo[value].seatEntitlements.push(seatEntitlement.ruleId);
        return priceMemo;
      });
      return priceMemo;
    }, seatDetails);

    each(passengerSeatDetail.passengerRefs, function (passengerRef) {
      memo.push(extend({}, { seatDetails: seatDetails }, { passengerRef: passengerRef }));
    });
    return memo;
  }, []);
};

var seatMaps = (function (input) {
  var normalizedOutput = normalizr.normalize(input, { passengers: { seatMapPassenger: [seatPassengers] } });
  var segments = map(get(input, 'seatMap'), 'segment');

  normalizedOutput.entities.seatMaps = reduce(get(input, 'seatMap'), function (memo, seatMap) {
    if (seatMap) {
      var segmentId = get(seatMap, 'segment.id', uniqueId('s'));
      set(seatMap, 'passengerSeatDetails', transformPassengerSeatDetail(seatMap.passengerSeatDetails));
      set(seatMap, 'segment.id', segmentId);
      set(memo, seatMap.id, normalizr.normalize(seatMap, {
        cabin: [seatCabins], segment: seatSegments, pricing: { price: [seatPrices] }, passengerSeatDetails: [passengerSeatDetail]
      }));
    }
    return memo;
  }, {});

  normalizedOutput.result.segments = segments;

  if (normalizedOutput.result.seatMap) {
    normalizedOutput.result.seatMap = map(normalizedOutput.result.seatMap, 'id');
  }

  if (get(normalizedOutput, ['entities', 'seatPassengers'])) {
    normalizedOutput.result.relations = flatMap(get(normalizedOutput, 'entities.seatMaps'), function (seatMap) {
      var segmentId = get(seatMap, 'result.segment', '');

      var _get = get(seatMap, ['entities', 'segments', segmentId]),
          airline = _get.airline,
          flightNumber = _get.flightNumber,
          departureAirport = _get.departureAirport,
          arrivalAirport = _get.arrivalAirport,
          departureDate = _get.departureDate,
          bookingClass = _get.bookingClass,
          equipment = _get.equipment;

      return flatMap(get(seatMap, 'result.passengerSeatDetails'), function (passengerRef) {
        return {
          seatPassenger: passengerRef,
          seatMap: seatMap.result.id,
          airline: airline,
          flightNumber: flightNumber,
          departureAirport: departureAirport,
          arrivalAirport: arrivalAirport,
          departureDate: departureDate,
          bookingClass: bookingClass,
          equipment: equipment,
          passenger: get(normalizedOutput, ['entities', 'seatPassengers', passengerRef, 'passenger'])
        };
      });
    }, []);
  } else {
    normalizedOutput.result.relations = flatMap(get(normalizedOutput, 'entities.seatMaps'), function (seatMap) {
      var segmentId = get(seatMap, 'result.segment', '');

      var _get2 = get(seatMap, ['entities', 'segments', segmentId]),
          airline = _get2.airline,
          flightNumber = _get2.flightNumber,
          departureAirport = _get2.departureAirport,
          arrivalAirport = _get2.arrivalAirport,
          departureDate = _get2.departureDate,
          bookingClass = _get2.bookingClass,
          equipment = _get2.equipment;

      return {
        seatPassenger: 'ALL',
        seatMap: seatMap.result.id,
        airline: airline,
        flightNumber: flightNumber,
        departureAirport: departureAirport,
        arrivalAirport: arrivalAirport,
        departureDate: departureDate,
        bookingClass: bookingClass,
        equipment: equipment,
        passenger: 'ALL'
      };
    });
  }

  return normalizedOutput;
});



var checkin = Object.freeze({
	pnrNormalizer: index,
	seatMapNormalizer: seatMaps
});

var availableNormalizers = {
  checkin: checkin
};

/**
 * @param {object} json - JSON result of a service call
 * @param {*} [normalizers=false] - callback function to be invoked after service
 * @returns {*} result of invoking service and running the response through normalizers
 */
var normalizeResponse = function normalizeResponse(json) {
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  if (normalizers) {
    if (typeof normalizers === 'function') {
      return flow([normalizers])(json);
    } else if (normalizers instanceof Array) {
      var builtFlows = [];

      each(normalizers, function (normalizer) {
        var resolvedNormalizer = get(availableNormalizers, normalizer);
        if (resolvedNormalizer && typeof resolvedNormalizer === 'function') {
          builtFlows.push(resolvedNormalizer);
        } else {
          throw new Error('Unable to resolve path with argument "' + normalizer + '". Please send a valid path to a normalizer.');
        }
      });

      return flow(builtFlows)(json);
    }
  }
  return json;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var get$1 = function get$$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

/** Class handling http calls to Digital Connect instance */

var NetworkLink = function () {
  /**
   * Create an instance for network calls
   *
   * @param {object} [args] - argument object
   * @param {object} [headers={}] - headers to be added to each request
   * @param {function} [shouldRetry] - a function to determine if the SDK should retry the same call again in case of network error
   */
  function NetworkLink(_ref) {
    var _ref$headers = _ref.headers,
        headers = _ref$headers === undefined ? {} : _ref$headers,
        shouldRetry = _ref.shouldRetry;
    classCallCheck(this, NetworkLink);

    /**
     * Headers to be sent in each request
     * @type {Object}
     */
    this.headers = headers;
    /**
     * the function to be called to determine if the sdk should retry the request
     * @type {function}
     */
    this.shouldRetry = shouldRetry;
  }

  /**
   * Entry method.
   *
   * Invokes function supplied to build the network request.
   * Sends request down the pipe.
   * @param {function} invoke - builds the URL & body of the request about to be sent
   * @returns {Promise}
   */


  createClass(NetworkLink, [{
    key: 'buildRequest',
    value: function buildRequest(invoke) {
      var _this = this;

      var _getValue = getValue('config'),
          baseUrl = _getValue.baseUrl,
          storefront = _getValue.storefront,
          headers = _getValue.headers,
          agent = _getValue.agent;

      var execution = getExecutionKey();

      var requestParameters = invoke({
        headers: headers, baseUrl: baseUrl, storefront: storefront, execution: execution
      });

      var requestUrl = requestParameters.url + '?' + NetworkLink.buildQueryString(requestParameters.queryParameters);

      return this.sendRequest(requestUrl, _extends({}, requestParameters.body, { agent: agent })).then(function (response) {
        var status = response.status;

        if (status !== 200) {
          return response.json().then(function (json) {
            throw assign({}, json, { status: status });
          });
        }
        return response.json().then(function (json) {
          var processedJson = _this.postResponseProcessing(response, json);
          return normalizeResponse(processedJson, requestParameters.normalizers);
        });
      });
    }

    /**
     * Builds the query parameter string
     *
     * @param {array|object} queryParameters - parameters to include in the URL
     */

  }, {
    key: 'sendRequest',


    /**
     * Sends the request down the network tube
     *
     * @access private
     * @param {string} url - URL the request goes to
     * @param {object} args - arguments object
     * @param {string} args.method - HTTP method to use for Request e.g. GET, POST, PUT
     * @param {object} args.body - body of the HTTP call
     * @param {string} args.agent - agent to use for the HTTP call
     * @param {function} args.shouldRetry - a function to determine if the SDK should retry the same call again in case of network error
     * @returns {Promise}
     */
    value: function sendRequest(url, _ref2) {
      var _this2 = this;

      var method = _ref2.method,
          body = _ref2.body,
          agent = _ref2.agent,
          shouldRetry = _ref2.shouldRetry;

      var options = this.wrapRequest(method, body, agent);
      var shouldRetryFn = shouldRetry || this.shouldRetry;

      var now = Date.now();
      this.onBeforeSend({ url: url, options: options });

      var successHandler = function successHandler(response) {
        return _this2.onComplete({
          url: url,
          options: options,
          response: response,
          took: Date.now() - now
        });
      };

      var errorHandler = function errorHandler(error) {
        return _this2.onComplete({
          url: url,
          options: options,
          error: error,
          took: Date.now() - now
        });
      };

      if (shouldRetryFn === undefined) {
        return fetch(url, options).then(function (response) {
          successHandler(response);
          return Promise.resolve(response);
        }).catch(function (error) {
          errorHandler(error);
          throw error;
        });
      }

      return fetch(url, options).then(function (response) {
        successHandler(response);
        return Promise.resolve(response);
      }).catch(function (error) {
        errorHandler(error);
        if (!shouldRetryFn({ error: error, url: url, options: options })) {
          throw error;
        }
        return fetch(url, options);
      });
    }

    /**
     * Wraps the request with appropriate headers and other properties for call to work in DC
     *
     * @access private
     * @param {string} method - HTTP method to use for Request e.g. GET, POST, PUT
     * @param {object} body - body of the HTTP call
     * @param {string} agent - agent to use for the HTTP call
     * @returns {object} {agent: string, body: object, credentials: string, method: string, headers: object}
     */

  }, {
    key: 'wrapRequest',
    value: function wrapRequest(method, body, agent) {
      var headers = assign({
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }, this.headers);

      return {
        agent: agent,
        body: JSON.stringify(body),
        credentials: 'include',
        method: method,
        headers: headers
      };
    }

    /**
     * Handles processing the response.
     * Useful for setting cookies/execution key/headers returned from the request
     *
     * @access private
     * @param {object} response - response returned by the service
     * @param {object} json - json response from the service call
     * @return {object} response - the http call response
     */

  }, {
    key: 'postResponseProcessing',
    value: function postResponseProcessing(response, json) {
      saveExecutionKey(response);
      if (response.headers) {
        this.saveHeaders(response.headers);
      }
      return json;
    }

    /**
     * triggered when the request completed, regardless the response status
     *
     * @access private
     * @param {string} url - the request url
     * @param {object} options - the request options
     * @param {object} error - the error thrown
     * @return {object} response - the http call response
     */

  }, {
    key: 'onComplete',
    value: function onComplete(_ref3) {
      var url = _ref3.url,
          options = _ref3.options,
          response = _ref3.response,
          error = _ref3.error;
    } // eslint-disable-line no-unused-vars,class-methods-use-this,object-curly-newline


    /**
     * triggered before the request sent to the server
     *
     * @access private
     * @param {string} url - the request url
     * @param {object} options - the request options
     * @param {object} error - the error thrown
     * @return {object} response - the http call response
     */

  }, {
    key: 'onBeforeSend',
    value: function onBeforeSend(_ref4) {
      var url = _ref4.url,
          options = _ref4.options;
    } // eslint-disable-line no-unused-vars,class-methods-use-this,object-curly-newline


    /**
     * Saves appropriate headers for response
     *
     * @access private
     * @param {Map} headers - headers returned by network request
     */

  }, {
    key: 'saveHeaders',
    value: function saveHeaders(headers) {
      var sessionId = headers.get('session-id');

      if (sessionId) {
        this.headers['Session-ID'] = sessionId;
      }
    }
  }], [{
    key: 'buildQueryString',
    value: function buildQueryString(queryParameters) {
      return join(map(pickBy(queryParameters), function (value, name) {
        return name + '=' + value;
      }), '&');
    }
  }]);
  return NetworkLink;
}();

/** Class handling http calls to Digital Connect instance that saves cookies */

var CookingSavingNetworkLink = function (_NetworkLink) {
  inherits(CookingSavingNetworkLink, _NetworkLink);

  function CookingSavingNetworkLink() {
    classCallCheck(this, CookingSavingNetworkLink);
    return possibleConstructorReturn(this, (CookingSavingNetworkLink.__proto__ || Object.getPrototypeOf(CookingSavingNetworkLink)).apply(this, arguments));
  }

  createClass(CookingSavingNetworkLink, [{
    key: 'postResponseProcessing',

    /**
     * @override
     * @param response
     */
    value: function postResponseProcessing(response) {
      get$1(CookingSavingNetworkLink.prototype.__proto__ || Object.getPrototypeOf(CookingSavingNetworkLink.prototype), 'postResponseProcessing', this).call(this, response);
      var cookie = response.headers.get('set-cookie');
      if (cookie.includes('JSESSION')) {
        this.headers.cookie = response.headers.get('set-cookie');
      }
    }
  }]);
  return CookingSavingNetworkLink;
}(NetworkLink);

/**
 * Initialize a Sabre DC SDK Client instance
 * @param {object} args - Initialize function arguments
 * @param {string} args.baseUrl - Base URL for DC instance
 * @param {string} args.storefront - Storefront associated with this instance
 * @param {object} args.headers - additional headers to be supplied to each request
 * @param {NetworkLink} [args.networkLink] - NetworkLink instance to use (overwrites default)
 * @param {function} args.shouldRetry - a function to determine if the SDK should retry the same call again in case of network error
 */
var initialize = (function (_ref) {
  var baseUrl = _ref.baseUrl,
      storefront = _ref.storefront,
      headers = _ref.headers,
      networkLink = _ref.networkLink,
      agent = _ref.agent,
      shouldRetry = _ref.shouldRetry;

  setValue('config', {
    baseUrl: baseUrl, storefront: storefront, headers: headers, networkLink: networkLink || new NetworkLink({ headers: headers, shouldRetry: shouldRetry }), agent: agent
  });
});

/**
 * Execute a flight search
 * @param {object} args - argument object
 * @param {string} args.cabinClass - cabin class to search for
 * @param {boolean} args.awardBooking - award booking flag
 * @param {string} args.searchType - search type
 * @param {Array<string>} args.promoCodes - promo codes to apply to search
 * @param {Array<object>} args.itineraryParts - Itinerary parts defined by DC to search for
 * @param {object} args.passengers - passengers counts to be included in search
 */
var flightSearch = function flightSearch(_ref) {
  var cabinClass = _ref.cabinClass,
      awardBooking = _ref.awardBooking,
      searchType = _ref.searchType,
      promoCodes = _ref.promoCodes,
      itineraryParts = _ref.itineraryParts,
      passengers = _ref.passengers;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/products/air/search',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: {
          cabinClass: cabinClass, awardBooking: awardBooking, searchType: searchType, promoCodes: promoCodes, itineraryParts: itineraryParts, passengers: passengers
        },
        headers: headers
      }
    };
  });
};

/**
 * Creates the URL string for selecting flights
 *
 * @access private
 * @param {Array<number>} selectFlights - flight has codes to select
 * @returns {string} URL Query parameter of flights to select
 */
function createSelectFlightString(selectFlights) {
  var prefix = 'selectFlights=';
  return join(selectFlights, prefix + '&');
}

/**
 * Select flights
 * @param {Array<number>} selectFlights - flight has codes to select
 */
var flightSelect = function flightSelect(_ref) {
  var selectFlights = _ref.selectFlights;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront,
        execution = _ref2.execution;
    return {
      url: baseUrl + '/products/air',
      queryParameters: {
        jipcc: storefront,
        execution: execution,
        selectFlights: createSelectFlightString(selectFlights)
      },
      body: {
        method: 'POST',
        headers: headers
      }
    };
  });
};

/**
 * Add Passenger to Itinerary
 * @param {object} args - argument object
 * @param {Array<object>} args.passengers - Passengers object defined by DC
 * @param {object} args.businessLoyalty - businessLoyalty object defined by DC
 * @param {object} args.contact - contact info defined by DC
 */
var addPassengers = function addPassengers(_ref) {
  var passengers = _ref.passengers,
      businessLoyalty = _ref.businessLoyalty,
      contact = _ref.contact;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront,
        execution = _ref2.execution;
    return {
      url: baseUrl + '/passengers',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'POST',
        body: {
          passengers: passengers, businessLoyalty: businessLoyalty, contact: contact
        },
        headers: headers
      }
    };
  });
};

/**
 * Purchase the selected itinerary
 * @param {object} args - argument object
 * @param {Array<object>} args.payment - payment object defined by DC
 * @param {object} args.billingData - billing data defined by DC
 */
var purchase = function purchase(_ref) {
  var payment = _ref.payment,
      billingData = _ref.billingData;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront,
        execution = _ref2.execution;
    return {
      url: baseUrl + '/purchase',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'POST',
        body: {
          payment: payment, billingData: billingData
        },
        headers: headers
      }
    };
  });
};

/**
 * Gets seat map for currently selected flights
 */
var getSeats = function getSeats() {
  return getNetworkLink().buildRequest(function (_ref) {
    var headers = _ref.headers,
        baseUrl = _ref.baseUrl,
        storefront = _ref.storefront,
        execution = _ref.execution;
    return {
      url: baseUrl + '/products/seats',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'GET',
        headers: headers
      }
    };
  });
};

/**
 * Get available Ancillaries on the selected flights
 */
var getAncillaries = function getAncillaries() {
  return getNetworkLink().buildRequest(function (_ref) {
    var headers = _ref.headers,
        baseUrl = _ref.baseUrl,
        storefront = _ref.storefront,
        execution = _ref.execution;
    return {
      url: baseUrl + '/products/ancillaries',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'GET',
        headers: headers
      }
    };
  });
};

/**
 * Add Ancillaries to the PNR
 * @param {Array<object>} ancillaryOperations - Ancillary Operations body defined by DC
 */
var addAncillaries = function addAncillaries(_ref) {
  var ancillaryOperations = _ref.ancillaryOperations;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront,
        execution = _ref2.execution;
    return {
      url: baseUrl + '/products/ancillaries',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'POST',
        body: {
          ancillaryOperations: ancillaryOperations
        },
        headers: headers
      }
    };
  });
};

/**
 * Select Seats
 * @param {Array<object>} seatOperations - Seat Operations body defined by DC
 */
var selectSeats = function selectSeats(_ref) {
  var seatOperations = _ref.seatOperations;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront,
        execution = _ref2.execution;
    return {
      url: baseUrl + '/products/seats',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'POST',
        body: {
          seatOperations: seatOperations
        },
        headers: headers
      }
    };
  });
};



var index$1 = Object.freeze({
	flightSearch: flightSearch,
	flightSelect: flightSelect,
	addPassengers: addPassengers,
	purchase: purchase,
	getSeats: getSeats,
	getAncillaries: getAncillaries,
	addAncillaries: addAncillaries,
	selectSeats: selectSeats
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * book
 * Path: dcci/ancillaries/book
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return AncillariesBookResponse - book response.
 *
 *
 */
/* istanbul ignore next: generated code */
var book = function book(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/ancillaries/book',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * cancel
 * Path: dcci/ancillaries/cancel
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return AncillariesCancelResponse - cancel response.
 *
 *
 */
/* istanbul ignore next: generated code */
var cancel = function cancel(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/ancillaries/cancel',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'DELETE',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * offers
 * Path: dcci/ancillaries/offers
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return AncillariesOffersResponse - offers response.
 *
 *
 */
/* istanbul ignore next: generated code */
var offers = function offers(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/ancillaries/offers',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$2 = Object.freeze({
	book: book,
	cancel: cancel,
	offers: offers
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * book
 * Path: dcci/baggage/book
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return BaggageBookResponse - book response.
 *
 *
 */
/* istanbul ignore next: generated code */
var book$2 = function book(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/baggage/book',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * cancel
 * Path: dcci/baggage/cancel
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return BaggageCancelResponse - cancel response.
 *
 *
 */
/* istanbul ignore next: generated code */
var cancel$2 = function cancel(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/baggage/cancel',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'DELETE',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * checkin
 * Path: dcci/baggage/checkin
 *
 * @desc This configuration property should be set to **true**, when there is no need to assign or unassign bag tag printer on DCCI side:

**se.adapter.s4ci.checkinbaggage.bagTagPrinter.skip.assignment**

False value is set by default.
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return BaggageCheckInResponse - checkin response.
 *
 *
 */
/* istanbul ignore next: generated code */
var checkin$1 = function checkin(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/baggage/checkin',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * price
 * Path: dcci/baggage/price
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return BaggagePriceResponse - price response.
 *
 *
 */
/* istanbul ignore next: generated code */
var price = function price(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/baggage/price',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$3 = Object.freeze({
	book: book$2,
	cancel: cancel$2,
	checkin: checkin$1,
	price: price
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * compensationTravelBank
 * Path: dcci/compensation/travelbank
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return TravelBankCompensationResponse - compensationTravelBank response.
 *
 *
 */
/* istanbul ignore next: generated code */
var compensationTravelBank = function compensationTravelBank(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/compensation/travelbank',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

// eslint-disable-line import/prefer-default-export

var index$4 = Object.freeze({
	compensationTravelBank: compensationTravelBank
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * flightdetails
 * Path: dcci/flight/details
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return FlightDetailsResponse - flightdetails response.
 *
 *
 */
/* istanbul ignore next: generated code */
var flightdetails = function flightdetails(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/flight/details',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

// eslint-disable-line import/prefer-default-export

var index$5 = Object.freeze({
	flightdetails: flightdetails
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * sendMail
 * Path: dcci/notification/mail
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return SendMailResponse - sendMail response.
 *
 *
 */
/* istanbul ignore next: generated code */
var sendMail = function sendMail(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/notification/mail',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

// eslint-disable-line import/prefer-default-export

var index$6 = Object.freeze({
	sendMail: sendMail
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerBoard
 * Path: dcci/passenger/board
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return BoardPassengerResponse - passengerBoard response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerBoard = function passengerBoard(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/board',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerBoardingPass
 * Path: dcci/passenger/boardingpass
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return BoardingPassResponse - passengerBoardingPass response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerBoardingPass = function passengerBoardingPass(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/boardingpass',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerBoardingPassReprint
 * Path: dcci/passenger/boardingpass/reprint
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return ReprintBoardingPassResponse - passengerBoardingPassReprint response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerBoardingPassReprint = function passengerBoardingPassReprint(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/boardingpass/reprint',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerCheckIn
 * Path: dcci/passenger/checkin
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return CheckInResponse - passengerCheckIn response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerCheckIn = function passengerCheckIn(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/checkin',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerDetails
 * Path: dcci/passenger/details
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PnrLookupResponse - passengerDetails response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerDetails = function passengerDetails(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/details',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerDetailsSession
 * Path: dcci/passenger/details
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PnrLookupResponse - passengerDetailsSession response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerDetailsSession = function passengerDetailsSession() {
  var normalizers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref) {
    var headers = _ref.headers,
        baseUrl = _ref.baseUrl,
        storefront = _ref.storefront;
    return {
      url: baseUrl + '/dcci/passenger/details',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'GET',
        body: undefined,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerList
 * Path: dcci/passenger/list
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return GetPassengerListResponse - passengerList response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerList = function passengerList(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/list',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerLookup
 * Path: dcci/passenger/lookup
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PaxLookupResponse - passengerLookup response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerLookup = function passengerLookup(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/lookup',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerLookupSession
 * Path: dcci/passenger/lookup
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PaxLookupResponse - passengerLookupSession response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerLookupSession = function passengerLookupSession() {
  var normalizers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref) {
    var headers = _ref.headers,
        baseUrl = _ref.baseUrl,
        storefront = _ref.storefront;
    return {
      url: baseUrl + '/dcci/passenger/lookup',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'GET',
        body: undefined,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerOffload
 * Path: dcci/passenger/offload
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return OffloadPassengerResponse - passengerOffload response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerOffload = function passengerOffload(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/offload',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerUnboard
 * Path: dcci/passenger/unboard
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return UnboardPassengerResponse - passengerUnboard response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerUnboard = function passengerUnboard(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/unboard',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * passengerUpdate
 * Path: dcci/passenger/update
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PassengerDetailsResponse - passengerUpdate response.
 *
 *
 */
/* istanbul ignore next: generated code */
var passengerUpdate = function passengerUpdate(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/update',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * priorityPriority
 * Path: dcci/passenger/priority
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return AddToPriorityListResponse - priorityPriority response.
 *
 *
 */
/* istanbul ignore next: generated code */
var priorityPriority = function priorityPriority(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/passenger/priority',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$7 = Object.freeze({
	passengerBoard: passengerBoard,
	passengerBoardingPass: passengerBoardingPass,
	passengerBoardingPassReprint: passengerBoardingPassReprint,
	passengerCheckIn: passengerCheckIn,
	passengerDetails: passengerDetails,
	passengerDetailsSession: passengerDetailsSession,
	passengerList: passengerList,
	passengerLookup: passengerLookup,
	passengerLookupSession: passengerLookupSession,
	passengerOffload: passengerOffload,
	passengerUnboard: passengerUnboard,
	passengerUpdate: passengerUpdate,
	priorityPriority: priorityPriority
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * pay
 * Path: dcci/pay
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PaymentResponse - pay response.
 *
 *
 */
/* istanbul ignore next: generated code */
var pay = function pay(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/pay',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * payAuthorized
 * Path: dcci/pay/authorized
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return AuthorizedPaymentResponse - payAuthorized response.
 *
 *
 */
/* istanbul ignore next: generated code */
var payAuthorized = function payAuthorized(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/pay/authorized',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$8 = Object.freeze({
	pay: pay,
	payAuthorized: payAuthorized
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * assign
 * Path: dcci/printers/assign
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PrinterResponse - assign response.
 *
 *
 */
/* istanbul ignore next: generated code */
var assign$1 = function assign$$1(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/printers/assign',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * unassign
 * Path: dcci/printers/unassign
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return PrinterResponse - unassign response.
 *
 *
 */
/* istanbul ignore next: generated code */
var unassign = function unassign(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/printers/unassign',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$9 = Object.freeze({
	assign: assign$1,
	unassign: unassign
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * reservationCreate
 * Path: dcci/reservation/create
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return ReservationResponse - reservationCreate response.
 *
 *
 */
/* istanbul ignore next: generated code */
var reservationCreate = function reservationCreate(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/reservation/create',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * reservationUpdate
 * Path: dcci/reservation/update
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return ReservationDetailsResponse - reservationUpdate response.
 *
 *
 */
/* istanbul ignore next: generated code */
var reservationUpdate = function reservationUpdate(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/reservation/update',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * reservationUpdateDelete
 * Path: dcci/reservation/update
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return ReservationDetailsResponse - reservationUpdateDelete response.
 *
 *
 */
/* istanbul ignore next: generated code */
var reservationUpdateDelete = function reservationUpdateDelete(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/reservation/update',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'DELETE',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$10 = Object.freeze({
	reservationCreate: reservationCreate,
	reservationUpdate: reservationUpdate,
	reservationUpdateDelete: reservationUpdateDelete
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * seatsSeatMap
 * Path: dcci/seats/seatmap
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return SeatsSeatMapResponse - seatsSeatMap response.
 *
 *
 */
/* istanbul ignore next: generated code */
var seatsSeatMap = function seatsSeatMap(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.seatMapNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/seats/seatmap',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * seatsSelect
 * Path: dcci/seats/select
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return SeatSelectResponse - seatsSelect response.
 *
 *
 */
/* istanbul ignore next: generated code */
var seatsSelect = function seatsSelect(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/seats/select',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$11 = Object.freeze({
	seatsSeatMap: seatsSeatMap,
	seatsSelect: seatsSelect
});

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * timaticAdd
 * Path: dcci/timatic/add
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return TimaticAddResponse - timaticAdd response.
 *
 *
 */
/* istanbul ignore next: generated code */
var timaticAdd = function timaticAdd(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/timatic/add',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * timaticOverride
 * Path: dcci/timatic/override
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return TimaticOverrideResponse - timaticOverride response.
 *
 *
 */
/* istanbul ignore next: generated code */
var timaticOverride = function timaticOverride(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/timatic/override',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};

/* istanbul ignore file: generated code */
/**
 * IMPORTANT: This is a generated file!
 * Do not make changes!
 * They will be lost on the next update.
 *
 * See README for more details.
 */

/**
 * timaticVerify
 * Path: dcci/timatic/verify
 *
 * @desc Description Not Provided
 *
 * @param {object} arguments - arguments Object
 * @param {string} arguments.jipcc - (query) - Storefront identifier.
 * @param {string} arguments.Session-ID - (header) - Used to identify a stateful process. It's generated and returned by DCCI once stateful process is entered.
 * @param {string} arguments.Authorization - (header) - Gateway authorization details.
 * @param {string} arguments.Application-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Conversation-ID - (header) - Used to identify current conversation
 * @param {string} arguments.Message-ID - (header) - Used to identify current service transaction
 * @param {string} arguments.Diagnostics - (header) - Technical swithc that enables additional diagnostic information. Should be used only for troubleshooting as it may significantly increase response payload.
 * @param {string} arguments.Traces - (header) - Technical switch that enables trace information returned in the response.
 * @param {*} [normalizers] - (parameter) - Normalizer function to pass the response through
 *
 * @return TimaticVerifyResponse - timaticVerify response.
 *
 *
 */
/* istanbul ignore next: generated code */
var timaticVerify = function timaticVerify(_ref) {
  var body = _ref.body;
  var normalizers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ['checkin.pnrNormalizer'];
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/dcci/timatic/verify',
      queryParameters: {
        jipcc: storefront
      },
      body: {
        method: 'POST',
        body: body,
        headers: headers
      },
      normalizers: normalizers
    };
  });
};



var index$12 = Object.freeze({
	timaticAdd: timaticAdd,
	timaticOverride: timaticOverride,
	timaticVerify: timaticVerify
});



var index$13 = Object.freeze({
	ancillaries: index$2,
	baggage: index$3,
	compensation: index$4,
	flight: index$5,
	notification: index$6,
	passenger: index$7,
	pay: index$8,
	printers: index$9,
	reservation: index$10,
	seats: index$11,
	timatic: index$12
});

/**
 * Gets the state of the cart
 */
var getCart = function getCart() {
  return getNetworkLink().buildRequest(function (_ref) {
    var headers = _ref.headers,
        baseUrl = _ref.baseUrl,
        storefront = _ref.storefront,
        execution = _ref.execution;
    return {
      url: baseUrl + '/products/cart',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'GET',
        headers: headers
      }
    };
  });
};

/**
 * Gets the total payment amount from the cart response
 * @param cartResponse
 * @returns {number} - total amount to be paid
 */
var getTotalPaymentAmount = function getTotalPaymentAmount(cartResponse) {
  return get(cartResponse, 'productsInformation.total.alternatives[0][0]');
};

/**
 * Gets available Payment Options
 */
var getPaymentOptions = function getPaymentOptions() {
  return getNetworkLink().buildRequest(function (_ref) {
    var headers = _ref.headers,
        baseUrl = _ref.baseUrl,
        storefront = _ref.storefront,
        execution = _ref.execution;
    return {
      url: baseUrl + '/paymentOptions',
      queryParameters: {
        jipcc: storefront,
        execution: execution
      },
      body: {
        method: 'GET',
        headers: headers
      }
    };
  });
};

/**
 * Gets the PNR information for the supplied PNR
 * @param {string} pnr - PNR to lookup
 */
var getPnr = function getPnr(_ref) {
  var pnr = _ref.pnr;
  return getNetworkLink().buildRequest(function (_ref2) {
    var headers = _ref2.headers,
        baseUrl = _ref2.baseUrl,
        storefront = _ref2.storefront;
    return {
      url: baseUrl + '/pnr',
      queryParameters: {
        jipcc: storefront,
        pnr: pnr
      },
      body: {
        method: 'GET',
        headers: headers
      }
    };
  });
};



var index$14 = Object.freeze({
	getPaymentOptions: getPaymentOptions,
	getPnr: getPnr,
	getCart: getCart,
	getTotalPaymentAmount: getTotalPaymentAmount
});

exports.initialize = initialize;
exports.normalizers = availableNormalizers;
exports.CookieSavingNetworkLink = CookingSavingNetworkLink;
exports.booking = index$1;
exports.checkin = index$13;
exports.shared = index$14;
