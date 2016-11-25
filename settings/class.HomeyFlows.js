class HomeyFlows {
	constructor(bearerToken) {
		this.errorMessage = '';
		this.isReady = $.Deferred();
		if (bearerToken == null) return null;
		this._bearerToken = bearerToken;
		this._folders = null;
		this._flows = null;
		this._system = null;
		this._retrieveData();
	}
	
	getFolderById(folderId) {
		return folderId ? this._folders[folderId] : null;
	}

	getFlowById(flowId) {
		return flowId ? this._flows[flowId] : null;
	}

	getFolderPath(folderId) {
		var folder = this.getFolderById(folderId);
		if (folder == null) return '/';
		var path = '';
		if (folder.folder && (folder.folder.length > 0))
			path = this.getFolderPath(folder.folder);
		path += '/' + folder.title;
		return path;
	}

	isOk() {
		return (this._system != null) && (this._system.hostname != null) && (this._system.hostname.length > 0);
	}

	getHomeyName() {
		return this._system.hostname;
	}

	_checkIfReady() {
		if ((this._flows != null) && (this._folders != null) && (this._system != null))
			this.isReady.resolve(true);
	}

	_retrieveData() {
		this._retrieveDataFromHomey('/api/manager/flow/flow/', (err, result) => {
			this._flows = [];
			if (err)
				this.errorMessage = this._formatErrorMessage(err, __('retrievalError'));
			else
				this._flows = result.result;
			this._checkIfReady();
		});
		this._retrieveDataFromHomey('/api/manager/flow/Folder/', (err, result) => {
			this._folders = [];
			if (err)
				this.errorMessage = this._formatErrorMessage(err, __('retrievalError'));
			else
				this._folders = result.result;
			this._checkIfReady();
		});
		this._retrieveDataFromHomey('/api/manager/system/', (err, result) => {
			this._system = {};
			if (err)
				this.errorMessage = this._formatErrorMessage(err, __('retrievalError'));
			else
				this._system = result.result;
			this._checkIfReady();
		});
	}

	_formatErrorMessage(err, defaultMessage) {
		var errorMessage = null;
		if (err)
			errorMessage = err.toString();
		if (errorMessage == 'error')
			errorMessage = null;
		if ((errorMessage == null) || (errorMessage.length == 0))
			errorMessage = defaultMessage;
		return errorMessage;
	}

	_retrieveDataFromHomey(path, callback) {
		$.ajax({
			type: 'GET',
			url: path + '?_=' + new Date().getTime(),
			dataType: 'json',
			headers: { 'Authorization': 'Bearer ' + this._bearerToken },
			error(req, status) { callback(status || '', null); },
			success(data) { callback(null, data); }
		});
	}
}
