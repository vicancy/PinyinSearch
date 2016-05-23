// -- prepare: common utils
var $ = function (selector) {
	return typeof selector === "string" ? document.querySelectorAll(selector) : selector;
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
		_db = {},
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

			if (!allowMultiPronounce) {
				pinyinSentences = pinyinSentences.slice(0, 1);
			}

			if (callback) callback(pinyinSentences);
		})
	}

	_.index = function (dataset, label, callback) {
		label = label || "default";
		if (!_db.hasOwnProperty(label)) {
			_db[label] = [];
			_.init(function () {
				dataset.forEach(function (data) {
					_.convert(data.question, function (pinyins) {
						pinyins.forEach(function (pinyin) {
							_db[label].push({
								key: pinyin,
								data: data,
							});
						}, this);
					});
				}, this);
				if (callback) callback(_db[label]);
			});
		} else {
			if (callback) callback(_db[label]);
		}
	}

	_.search = function (key, label) {
		label = label || "default";
		_db[label] = _db[label] || [];
		return _db[label].filter(function (data) {
			return data.key.indexOf(key) > -1;
		}).map(function (data) {
			return data.data;
		})
	}

	return _;
} (searchEngine || {});

var dataCache = function (_) {
	var cached = {};
	_.get = function (url, callback) {
		if (cached.hasOwnProperty(url)) {
			var content = cached[url];
			if (callback) callback(content);
		} else {
			$.get(url, function (content) {
				if (callback) callback(content);
			})
		}
	}
	return _;
} (dataCache || {});

var templateEngine = function (_) {
	_.render = function (url, model, callback) {
		dataCache.get(url, function (template) {
			Mustache.parse(template);
			var rendered = Mustache.render(template, model);
			if (callback) callback(rendered);
		});
	};

	return _;
} (templateEngine || {});

var dataEngine = function (_) {
	var cached = {};
	_.load = function (url, callback) {
		dataCache.get(url, function (content) {
			if (!cached.hasOwnProperty(url)) {
				var data = JSON.parse(content).map(function (raw) {
					return {
						question: raw.q,
						answer: raw.a,
					}
				});

				searchEngine.index(data, url);
				cached[url] = data;
			}

			callback(cached[url]);
		});
	}
	return _;
} (dataEngine || {});

window.onload = function () {
	var input = $("#search-box-input")[0];
	window.addEventListener('keyup', function(e){
		// Enter key as the shortcut to focus to input
		if (e.code === 'Enter'){
			input.focus();
		}
	})
	input.addEventListener('keyup', function(e){
		// Delete key as the shortcut to cleanup input
		if (e.code === 'Delete'){
			input.value = '';
		}
	});
	input.addEventListener('input', function () {
		var val = input.value;
		search(val);
	});

	var selectors = $('.data-source-selector');
	for (var i = 0; i < selectors.length; i++) {
		activeClick(selectors[i]);
	}

	function search(val) {
		if (val.length < 3) return;
		var url = $('.active>.data-source-selector')[0].innerText;
		dataEngine.load(url, function (content) {
			var results = searchEngine.search(val, url);
			templateEngine.render("templates/result.mustache", { results: results }, function (html) {
				$("#search-group-content")[0].innerHTML = html;
			})
		});
	}

	function activeClick(element) {
		element.addEventListener('click', function () {
			setActive(element.parentElement.parentElement, element.parentElement);
		});
	}

	function setActive(parentElement, activeElement) {
		var children = parentElement.children;
		for (var i = 0; i < children.length; i++) {
			if (children[i] === activeElement) {
				children[i].classList.add('active');
			}
			else {
				children[i].classList.remove('active');
			}
		}
	}
};
