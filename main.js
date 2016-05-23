// -- prepare: common utils
var $ = function (selector) {
	return typeof selector === "string" ? document.querySelector(selector) : selector;
};

$.get = function (url, onload) {
	var request = new XMLHttpRequest();
	request.open('GET', url);
	request.onload = function () {
		onload(this.responseText);
	};
	request.send();
};

var searchEngine = function (_) {
	// _cache is mapping from character to pinyin, possible to have multiple pinyin
	var dbFile = _.dbFile || "database/PinyinMapping.json",
		allowMultiPronounce = _.allowMultiPronounce || false;
		_cache = {},
		_db = [],
		inited = false;
		
	_.init = function (callback) {
		if (inited) {
			if (callback) callback(_);
			return;
		}

		// Load pinyin database
		$.get(dbFile, function (content) {
			var pinyinData = JSON.parse(content);
			for (var key in pinyinData) {
				if (pinyinData.hasOwnProperty(key)) {
					var chars = pinyinData[key];
					for (var i = 0; i < chars.length; i++) {
						var char = chars[i];
						if (_cache.hasOwnProperty(char)) {
							_cache[char].push(key);
						} else {
							_cache[char] = [key];
						}
					}
				}
			}
			inited = true;
			if (callback) callback(_);
		})
	}

	// array 1 as ["a", "b"],
	// array 2 as ["c", "d"],
	// produces: ["ac", "ad", "bc", "bd"]
	function product(arr1, arr2) {
		if (arr1.length == 0) return arr2;
		if (arr2.length == 0) return arr1;
		var result = [];
		for (var i = 0; i < arr1.length; i++) {
			var former = arr1[i];
			for (var j = 0; j < arr2.length; j++) {
				var latter = arr2[j];
				result.push([].concat(former, latter).join(''));
			}
		}
		return [].concat(result[0]);
	}

	_.convert = function (sentence, callback) {
		var pinyinSentences = [];
		_.init(function () {
			for (var i = 0; i < sentence.length; i++) {
				var char = sentence[i];
				pinyins = _cache[char];
				if (pinyins === undefined) {
					pinyinSentences = product(pinyinSentences, [char]);
				} else {
					pinyinSentences = product(pinyinSentences, pinyins);
				}
			}
			
			if (!allowMultiPronounce){
				pinyinSentences = pinyinSentences.slice(0, 1);
			}
			
			if (callback) callback(pinyinSentences);
		})
	}

	_.index = function (dataset, callback) {
		_.init(function () {
			dataset.forEach(function (data) {
				_.convert(data.question, function (pinyins) {
					pinyins.forEach(function (pinyin) {
						_db.push({
							key: pinyin,
							data: data,
						});
					}, this);
				});
			}, this);
			if (callback) callback(_index);
		});
	}
	_.search = function (key) {
		return _db.filter(function (data) {
			return data.key.indexOf(key) > -1;
		}).map(function (data) {
			return data.data;
		})
	}

	return _;
} (searchEngine || {});


var templateEngine = function (_) {
	var cached = {};
	_.render = function (url, model, callback) {
		if (cached.hasOwnProperty(url)) {
			var template = cached[key];
			var rendered = Mustache.render(template, model);
			if (callback) callback(rendered);
		} else {
			$.get(url, function (template) {
				Mustache.parse(template);
				var rendered = Mustache.render(template, model);
				if (callback) callback(rendered);
			})
		}
	};
	
	return _;
} (templateEngine || {});

$.get("data.json", function (content) {
	var data = JSON.parse(content).map(function (raw) {
		return {
			question: raw.q,
			answer: raw.a,
		}
	});

	searchEngine.index(data);
});

window.onload = function () {
	var input = $("#search-box-input");
	input.addEventListener('input', function () {
		var val = input.value;
		if (val.length < 3) return;
		var results = searchEngine.search(val);
		templateEngine.render("templates/result.mustache", {results: results}, function(html){
			$("#search-group-content").innerHTML = html;
		})
	});
};
