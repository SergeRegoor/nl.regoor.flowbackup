var HomeyBackUp = function(homeyFlows) {
	if ((homeyFlows == null) || !homeyFlows.isOk()) return null;
	this._homeyFlows = homeyFlows;
};

HomeyBackUp.prototype.createFullBackUp = function(callback) {
	var zip = new JSZip();
	zip.file('backUpInfo.json', JSON.stringify({
		backUpDate: new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)),
		backUpVersion: 2,
		homeyName: this._homeyFlows.getHomeyName()
	}));
	zip.file('folders.json', JSON.stringify(this._homeyFlows._folders));
	zip.file('flows.json', JSON.stringify(this._homeyFlows._flows));
	zip.generateAsync({type:'blob'}).then(function(content) {
		callback(content);
	});
};

HomeyBackUp.prototype.readBackUpFile = function(selectedFile, callback) {
	var reader = new FileReader();
	reader.onload = function() {
		var backUpInfo = null;
		var folders = null;
		var flows = null;
		setTimeout(function() { if ((backUpInfo == null) || (folders == null) || (flows == null)) { callback(null); } }, 1000);
		JSZip.loadAsync(String.fromCharCode.apply(null, new Uint8Array(this.result))).then(function(zip) {
			zip.forEach(function(relativePath, zipEntry) {
				zipEntry.async('string').then(function(content) {
					if (zipEntry.name.toLowerCase() == 'backupinfo.json')
						backUpInfo = JSON.parse(content);
					else if (zipEntry.name.toLowerCase() == 'folders.json')
						folders = JSON.parse(content);
					else if (zipEntry.name.toLowerCase() == 'flows.json')
						flows = JSON.parse(content);
					
					if ((backUpInfo != null) && (folders != null) && (flows != null))
						callback(new BackUp(backUpInfo, folders, flows));
				});
			});
		});
	}
	reader.readAsArrayBuffer(selectedFile);
};

var BackUp = function(info, folders, flows) {
	this.info = info;
	this.folders = folders;
	this.flows = flows;
}

BackUp.prototype.getFolderById = function(folderId) {
	return folderId ? this.folders[folderId] : null;
};

BackUp.prototype.getFlowById = function(flowId) {
	return flowId ? this.flows[flowId] : null;
};

BackUp.prototype.getFolderPath = function(folderId) {
	var folder = this.getFolderById(folderId);
	if (folder == null) return '/';
	var path = '';
	if (folder.folder && (folder.folder.length > 0))
		path = this.getFolderPath(folder.folder);
	path += '/' + folder.title;
	return path;
};
