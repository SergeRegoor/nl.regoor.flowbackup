var HomeyFlows = function(bearerToken) {
	this.errorMessage = '';
	this.isReady = $.Deferred();
	if (bearerToken == null) return null;
	this._bearerToken = bearerToken;
	this._folders = null;
	this._flows = null;
	this._system = null;
	this._retrieveData();
	return this;
};

HomeyFlows.prototype.getFolderById = function(folderId) {
	return folderId ? this._folders[folderId] : null;
};

HomeyFlows.prototype.getFlowById = function(flowId) {
	return flowId ? this._flows[flowId] : null;
};

HomeyFlows.prototype.getFolderPath = function(folderId) {
	var folder = this.getFolderById(folderId);
	if (folder == null) return '/';
	var path = '';
	if (folder.folder && (folder.folder.length > 0))
		path = this.getFolderPath(folder.folder);
	path += '/' + folder.title;
	return path;
};

HomeyFlows.prototype.isOk = function() {
	return (this._system != null) && (this._system.hostname != null) && (this._system.hostname.length > 0);
};

HomeyFlows.prototype.getHomeyName = function() {
	return this._system.hostname;
};

HomeyFlows.prototype._checkIfReady = function() {
	if ((this._flows != null) && (this._folders != null) && (this._system != null))
		this.isReady.resolve(true);
};

HomeyFlows.prototype._retrieveData = function() {
	var _class = this;
	this._retrieveDataFromHomey('/api/manager/flow/flow/', function(err, result) {
		_class._flows = [];
		if (err)
			_class.errorMessage = _class._formatErrorMessage(err, __('retrievalError'));
		else
			_class._flows = result.result;
		_class._checkIfReady();
	});
	this._retrieveDataFromHomey('/api/manager/flow/Folder/', function(err, result) {
		_class._folders = [];
		if (err)
			_class.errorMessage = _class._formatErrorMessage(err, __('retrievalError'));
		else
			_class._folders = result.result;
		_class._checkIfReady();
	});
	this._retrieveDataFromHomey('/api/manager/system/', function(err, result) {
		_class._system = {};
		if (err)
			_class.errorMessage = _class._formatErrorMessage(err, __('retrievalError'));
		else
			_class._system = result.result;
		_class._checkIfReady();
	});
};

HomeyFlows.prototype._formatErrorMessage = function(err, defaultMessage) {
	var errorMessage = null;
	if (err)
		errorMessage = err.toString();
	if (errorMessage == 'error')
		errorMessage = null;
	if ((errorMessage == null) || (errorMessage.length == 0))
		errorMessage = defaultMessage;
	return errorMessage;
};

HomeyFlows.prototype._retrieveDataFromHomey = function(path, callback) {
	$.ajax({
		type: 'GET',
		url: path + '?_=' + new Date().getTime(),
		dataType: 'json',
		headers: { 'Authorization': 'Bearer ' + this._bearerToken },
		error: function(req, status) {
			if (status == null)
				status = '';
			callback(status, null);
		},
		success: function(data) {
			callback(null, data);
		}
	});
};