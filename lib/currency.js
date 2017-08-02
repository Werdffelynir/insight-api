'use strict';

var request = require('request');

function CurrencyController(options) {
  this.node = options.node;
  var refresh = options.currencyRefresh || CurrencyController.DEFAULT_CURRENCY_DELAY;

  this.currencyDelay = refresh * 6e4;

  // main server for get currency rate of sib/rur
  this.remoteServer = 'https://yobit.net/api/3/ticker/sib_rur';

  // if main server don`t answer
  this.remoteServerReserve = 'https://api.livecoin.net/exchange/ticker?currencyPair=SIB/RUR';

  // get currency bitcoin/usd/rur for calculate sib/usd
  this.remoteServerConvert = 'https://api.coinmarketcap.com/v1/ticker/bitcoin/?convert=RUR';

  this.rurRate = 0;
  this.usdRate = 0;
  this.bitstampRate = 0;

  this.timestamp = Date.now();
}

CurrencyController.DEFAULT_CURRENCY_DELAY = 10;

CurrencyController.prototype.index = function(req, res) {
  var self = this;
  var currentTime = Date.now();

  // checked result
  var _isSuccessRequest = function (status, err, data) {
    return status === 200 && !err && data && typeof data === 'object';
  };

  // common request
  var _request = function (url, callback) {
    request(url, function(err, response, body) {
      callback.call(self, response.statusCode, err, JSON.parse(body));
    });
  };

  // single request with USD calculate
  var _requestUSD = function () {
    _request(self.remoteServerConvert, function (status, err, data) {
      if (_isSuccessRequest(status, err, data)) {
        self.usdRate = (data[0]['price_rur'] / data[0]['price_usd']);
        res.jsonp({
          status: 200,
          data: {
            bitstamp: self.bitstampRate,
            rurusd: self.usdRate
          }
        });
      } else {
        self.node.log.error(err);
      }

    });
  };

  if ((self.rurRate === 0 || self.usdRate === 0) || currentTime >= (self.timestamp + self.currencyDelay)) {
    self.timestamp = currentTime;

    // base request
    _request(self.remoteServer, function (status, err, data) {

      if (_isSuccessRequest(status, err, data)) {
        self.rurRate = self.bitstampRate = parseFloat(data['sib_rur'].last);
        _requestUSD();

      } else {
        // reserve request
        _request(self.remoteServerReserve, function (status, err, data) {
          if (_isSuccessRequest(status, err, data)) {
            self.rurRate = self.bitstampRate = parseFloat(data.last);
            _requestUSD();

          } else {

            self.node.log.error(err);
          }
        });

      }

    });

  } else {

    res.jsonp({
      status: 200,
      data: {
        bitstamp: self.bitstampRate,
        rurusd: self.usdRate
      }
    });

  }

};

module.exports = CurrencyController;
