class HomeyRestore {
	constructor(homeyFlows) {
		if ((homeyFlows == null) || !homeyFlows.isOk()) return null;
		this._homeyFlows = homeyFlows;
	}
	
	restoreFlows(flowsToRestore, callback) {
		if ((flowsToRestore == null) || (flowsToRestore.toCreate == null) || (flowsToRestore.toOverwrite == null))
			callback({successful:false, errorMessages:[__('restore.noFlowsToRestoreError')]});
		else if ((flowsToRestore.toCreate.length == 0) && (flowsToRestore.toOverwrite.length == 0))
			callback({successful:false, errorMessages:[__('restore.noFlowsToRestoreError')]});
		else {
			var confirmationMessage = __('restore.confirmRestorePart1');
			if (flowsToRestore.toCreate.length > 0)
				confirmationMessage += __('restore.confirmRestoreCreate').replace('[quantity]', flowsToRestore.toCreate.length).replace('[flows]', flowsToRestore.toCreate.length > 1 ? __('restore.confirmRestoreFlows') : __('restore.confirmRestoreFlow'));
			if (flowsToRestore.toOverwrite.length > 0) {
				if (flowsToRestore.toCreate.length > 0)
					confirmationMessage += __('restore.confirmRestoreAnd');
				confirmationMessage += __('restore.confirmRestoreOverwrite').replace('[quantity]', flowsToRestore.toOverwrite.length).replace('[flows]', flowsToRestore.toOverwrite.length > 1 ? __('restore.confirmRestoreFlows') : __('restore.confirmRestoreFlow'));
			}
			confirmationMessage += __('restore.confirmRestorePart2');
			if (!confirm(confirmationMessage)) return;
			
			if (flowsToRestore.toCreate.length > 0) {
				this._createFlows(flowsToRestore.toCreate, (result) => {
					if (!result.successful)
						callback(result);
					else
						this._overwriteFlows(flowsToRestore.toCreate.concat(flowsToRestore.toOverwrite), (result) => { callback(result); });
				});
			} else
				_this._overwriteFlows(flowsToRestore.toOverwrite, (result) => { callback(result); });
		}
	}

	_createFlows(flowsToCreate, callback) {
		var nrOfFlowsLeft = flowsToCreate.length;
		var nrOfErrors = 0;
		$.each(flowsToCreate, (i, flowToCreate) => {
			this._sendDataToHomey('POST', '/api/manager/flow/flow/', {}, (err, result) => {
				nrOfFlowsLeft--;
				if (err || !result || !result.result)
					nrOfErrors++;
				else
					flowToCreate.flowId = result.result.id;
				if (nrOfFlowsLeft == 0) {
					if (nrOfErrors > 0)
						callback({successful:false, errorMessages:[__('restore.createError').replace('[quantity]', nrOfErrors)]});
					else
						callback({successful:true});
				}
			});
		});
	}

	_overwriteFlows(flowsToOverwrite, callback) {
		var nrOfFlowsLeft = flowsToOverwrite.length;
		var nrOfErrors = 0;
		$.each(flowsToOverwrite, (i, flowToOverwrite) => {
			var flow = {
				title: flowToOverwrite.title,
				trigger: flowToOverwrite.backedUpFlow.trigger,
				conditions: flowToOverwrite.backedUpFlow.conditions,
				actions: flowToOverwrite.backedUpFlow.actions,
				enabled: flowToOverwrite.backedUpFlow.enabled,
				folder: ((flowToOverwrite.folderId != null) && (flowToOverwrite.folderId.length > 0)) ? flowToOverwrite.folderId : false,
				order: flowToOverwrite.backedUpFlow.order
			};
			
			this._sendDataToHomey('PUT', '/api/manager/flow/flow/' + flowToOverwrite.flowId, flow, (err, result) => {
				nrOfFlowsLeft--;
				if (err || !result || !result.result)
					nrOfErrors++;
				if (nrOfFlowsLeft == 0) {
					if (nrOfErrors > 0)
						callback({successful:false, errorMessages:[__('restore.restoreErrorQty').replace('[quantity]', nrOfErrors)]});
					else
						callback({successful:true});
				}
			});
		});
	}

	_sendDataToHomey(method, path, object, callback) {
		return $.ajax({
			type: method,
			url: path + '?_=' + new Date().getTime(),
			data: JSON.stringify(object),
			dataType: 'json',
			headers: {
				'Authorization': 'Bearer ' + this._homeyFlows._bearerToken,
				'Content-Type': 'application/json; charset=UTF-8',
				'Accept': '*/*'
			},
			error(req, status) { callback(status || '', null); },
			success(result) { callback(null, result); }
		});
	}
}