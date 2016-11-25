class HomeyBackUp {
	constructor(homeyFlows) {
		if ((homeyFlows == null) || !homeyFlows.isOk()) return null;
		this._homeyFlows = homeyFlows;
	}
	
	createFullBackUp(callback) {
		var zip = new JSZip();
		zip.file('backUpInfo.json', JSON.stringify({
			backUpDate: new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)),
			backUpVersion: 2,
			homeyName: this._homeyFlows.getHomeyName()
		}));
		zip.file('folders.json', JSON.stringify(this._homeyFlows._folders));
		zip.file('flows.json', JSON.stringify(this._homeyFlows._flows));
		zip.generateAsync({type:'blob', compression:'deflate', compressionOptions:{level:9}}).then((zipContents) => {
			callback(zipContents);
		});
	}

	readBackUpFile(selectedFile, callback) {
		var reader = new FileReader();
		reader.onload = () => {
			var backUpInfo = null;
			var folders = null;
			var flows = null;
			setTimeout(() => { if ((backUpInfo == null) || (folders == null) || (flows == null)) { callback(null); } }, 1000);
			var byteArray = new Uint8Array(reader.result);
			var stringArray = this.Uint8ToString(byteArray);
			JSZip.loadAsync(stringArray).then((zip) => {
				zip.forEach((relativePath, zipEntry) => {
					zipEntry.async('string').then((content) => {
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
	}

	Uint8ToString(u8a) {
		var chunkSize = 0x8000;
		var c = [];
		for (var i = 0; i < u8a.length; i += chunkSize)
			c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + chunkSize)));
		return c.join('');
	}
}

class BackUp {
	constructor(info, folders, flows) {
		this.info = info;
		this.folders = folders;
		this.flows = flows;
	}

	getFolderById(folderId) {
		return folderId ? this.folders[folderId] : null;
	}

	getFlowById(flowId) {
		return flowId ? this.flows[flowId] : null;
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
}