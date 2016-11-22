function onHomeyReady() {
	$('#buttonBackupAllFlows').hide();
	$('#buttonRestoreFlows').hide();
	$('#bearerTokenExplanation').hide();
	
	$('#fieldSetWarning button').click(function() { showErrorMessagesWithSelector($('#warningMessages').html(), 550, 300); });
	
	Homey.get('bearerToken', function(error, bearerToken){
		$('#textBearerToken').val(bearerToken);
		checkBearerToken(bearerToken);
	});
	
	$('#buttonSaveBearerToken').click(function(e) {
		e.preventDefault();
		var bearerToken = $('#textBearerToken').val();
		if (bearerToken.lastIndexOf('=') >= 0) {
			bearerToken = bearerToken.substring(bearerToken.lastIndexOf('=')+1);
			$('#textBearerToken').val(bearerToken);
		}
		Homey.set('bearerToken', $('#textBearerToken').val(), function(){
			checkBearerToken($('#textBearerToken').val());
		});
	});
	$('#buttonBackupAllFlows').click(function(e) {
		e.preventDefault();
		if (!hasBearerTokenConfigured()) { showErrorMessages([__('bearerToken.enterTokenFirst')]); return; }
		backupAllFlows();
	});
	$('#buttonRestoreFlows').click(function(e) {
		e.preventDefault();
		if (!hasBearerTokenConfigured()) { showErrorMessages([__('bearerToken.enterTokenFirst')]); return; }
		var fileSelector = $('<input/>').attr('type', 'file');
		fileSelector.change(function(e){
			var selectedFile = fileSelector.prop('files')[0];
			var reader = new FileReader();
			reader.onload = function() {
				var folders = null;
				var flows = null;
				setTimeout(function() { if ((folders == null) || (flows == null)) showError(__('restore.readError')); }, 1000);
				JSZip.loadAsync(String.fromCharCode.apply(null, new Uint8Array(this.result))).then(function(zip) {
					zip.forEach(function(relativePath, zipEntry) {
						zipEntry.async('string').then(function(content) {
							if (zipEntry.name.toLowerCase() == 'folders.json')
								folders = JSON.parse(content);
							else if (zipEntry.name.toLowerCase() == 'flows.json')
								flows = JSON.parse(content);
							
							if ((folders != null) && (flows != null))
								restoreFlows(folders, flows);
						});
					});
				});
			}
			reader.readAsArrayBuffer(selectedFile);
		});
		fileSelector.trigger('click');
	});
	$('#cancelRestoreButton').click(function() { $('#restoreList').empty(); $('#restoreContainer').hide(); });
	$('#performRestoreButton').click(function() {
		var flowsToCreate = [];
		var flowsToOverwrite = [];
		var currentFlows = $('#restoreList').data('currentFlows');
		
		$('#restoreList').find('.row:not(.head)').each(function(){
			var row = $(this);
			var backedUpFlow = row.data('backedUpFlow');
			if ((backedUpFlow != null) && !row.hasClass('disabled')) {
				var flowToRestore = {
					folderId: row.find('.folderSelector').val(),
					backedUpFlow: backedUpFlow,
					flowId: backedUpFlow.id,
					title: backedUpFlow.title
				};
				if (row.find('.flowActionSelector').val() == 'copyToNewFlow') {
					var currentFlow = getFlowById(currentFlows, flowToRestore.flowId);
					if (currentFlow != null)
						flowToRestore.title = __('restore.restoreTagInTitle') + flowToRestore.title;
					flowToRestore.flowId = createGuid();
					flowsToCreate.push(flowToRestore);
				} else if (row.find('.flowActionSelector').val() == 'overwriteExistingFlow')
					flowsToOverwrite.push(flowToRestore);
			}
		});
		
		if ((flowsToCreate.length + flowsToOverwrite.length) == 0)
			showError(__('restore.noFlowsToRestoreError'));
		else {
			var confirmationMessage = __('restore.confirmRestorePart1');
			if (flowsToCreate.length > 0)
				confirmationMessage += __('restore.confirmRestoreCreate').replace('[quantity]', flowsToCreate.length).replace('[flows]', flowsToCreate.length > 1 ? __('restore.confirmRestoreFlows') : __('restore.confirmRestoreFlow'));
			if (flowsToOverwrite.length > 0) {
				if (flowsToCreate.length > 0)
					confirmationMessage += __('restore.confirmRestoreAnd');
				confirmationMessage += __('restore.confirmRestoreOverwrite').replace('[quantity]', flowsToOverwrite.length).replace('[flows]', flowsToOverwrite.length > 1 ? __('restore.confirmRestoreFlows') : __('restore.confirmRestoreFlow'));
			}
			confirmationMessage += __('restore.confirmRestorePart2');
			if (!confirm(confirmationMessage)) return;
			
			if (flowsToCreate.length > 0) {
				createFlowsToRestore(flowsToCreate, function(createResult) {
					if (!createResult || !createResult.successful) {
						showErrorMessages([__('restore.createError').replace('[quantity]', createResult.nrOfErrors)]);
					} else
						var allFlows = flowsToCreate.concat(flowsToOverwrite);
						overwriteFlowsToRestore(allFlows, function(restoreResult) {
							finishRestore(restoreResult);
						});
				});
			} else
				overwriteFlowsToRestore(flowsToOverwrite, function(restoreResult) { finishRestore(restoreResult); });
		}
	});
	
	Homey.ready();
};

function checkBearerToken(bearerToken) {
	if ((bearerToken != null) && (bearerToken.length > 0)) {
		retrieveFolders(function(foldersError, foldersResult) {
			if (foldersError || !foldersResult) {
				$('#buttonBackupAllFlows').hide();
				$('#buttonRestoreFlows').hide();
				$('#bearerTokenExplanation').show();
				showInvalidBearerTokenMessage();
			}
			else {
				$('#buttonBackupAllFlows').show();
				$('#buttonRestoreFlows').show();
				$('#bearerTokenExplanation').hide();
			}
		});
	} else {
		$('#buttonBackupAllFlows').hide();
		$('#buttonRestoreFlows').hide();
		$('#bearerTokenExplanation').show();
	}
};

function showInvalidBearerTokenMessage() {
	showErrorMessages([__('bearerToken.enterTokenFirst')]);
};

function finishRestore(result) {
	$('#cancelRestoreButton').trigger('click');
	if (!result || !result.successful) {
		if (result.nrOfErrors > 0)
			showErrorMessages([__('restore.restoreErrorQty').replace('[quantity]', result.nrOfErrors)]);
		else
			showErrorMessages([__('restore.restoreError')]);
	} else
		showErrorMessages([__('restore.restoreMessage')]);
}

function createFlowsToRestore(flowsToCreate, callback) {
	var nrOfFlowsLeft = flowsToCreate.length;
	var nrOfErrors = 0;
	$.each(flowsToCreate, function(i, flowToCreate) {
		sendDataToHomey('POST', '/api/manager/flow/flow/', {}, function(err, result) {
			nrOfFlowsLeft--;
			if (err || !result || !result.result)
				nrOfErrors++;
			else
				flowToCreate.flowId = result.result.id;
			if (nrOfFlowsLeft == 0) {
				if (nrOfErrors > 0)
					callback({successful:false, nrOfErrors:nrOfErrors});
				else
					callback({successful:true});
			}
		});
	});
}

function overwriteFlowsToRestore(flowsToRestore, callback) {
	var nrOfFlowsLeft = flowsToRestore.length;
	var nrOfErrors = 0;
	$.each(flowsToRestore, function(i, flowToRestore) {
		var flow = {
			title: flowToRestore.title,
			trigger: flowToRestore.backedUpFlow.trigger,
			conditions: flowToRestore.backedUpFlow.conditions,
			actions: flowToRestore.backedUpFlow.actions,
			enabled: flowToRestore.backedUpFlow.enabled,
			folder: ((flowToRestore.folderId != null) && (flowToRestore.folderId.length > 0)) ? flowToRestore.folderId : false,
			order: flowToRestore.backedUpFlow.order
		};
		
		sendDataToHomey('PUT', '/api/manager/flow/flow/' + flowToRestore.flowId, flow, function(err, result) {
			nrOfFlowsLeft--;
			if (err || !result || !result.result)
				nrOfErrors++;
			if (nrOfFlowsLeft == 0) {
				if (nrOfErrors > 0)
					callback({successful:false, nrOfErrors:nrOfErrors});
				else
					callback({successful:true});
			}
		});
	});
};

function sendDataToHomey(method, path, object, callback) {
	return $.ajax({
		type: method,
		url: path + '?_=' + new Date().getTime(),
		data: JSON.stringify(object),
		dataType: 'json',
		headers: {
			'Authorization': 'Bearer ' + $('#textBearerToken').val(),
			'Content-Type': 'application/json; charset=UTF-8',
			'Accept': '*/*'
		},
		error: function(req, status) { if (status == null) status = ''; callback(status, null); },
		success: function(result) { callback(null, result); }
	});
};

function restoreFlows(backedUpFolders, backedUpFlows) {
	if ((backedUpFolders == null) || (backedUpFlows == null)) { showError(__('restore.restoreError')); return; }
	retrieveFolders(function(foldersError, foldersResult) {
		if (foldersError) showRetrievalError(foldersError);
		else retrieveFlows(function(flowsError, flowsResult) {
			if (flowsError) showRetrievalError(flowsError);
			else {
				var currentFolders = foldersResult.result;
				var currentFlows = flowsResult.result;
				
				$('#restoreContainer').show();
				var restoreList = $('#restoreList').addClass('list');
				restoreList.empty();
				restoreList.data('currentFolders', currentFolders);
				restoreList.data('currentFlows', currentFlows);
				
				var headerRow = $('<div/>').addClass('row head');
				headerRow.append($('<div/>').addClass('cell').text(__('restore.list.folderInBackup')));
				headerRow.append($('<div/>').addClass('cell').text(__('restore.list.flowTitle')));
				headerRow.append($('<div/>').addClass('cell').text(__('restore.list.folderToRestoreTo')));
				headerRow.append($('<div/>').addClass('cell').append($('<input/>').attr('type','checkbox').prop('checked',true).change(function(){
					var isChecked = $(this).prop('checked');
					$(this).parent().parent().parent().find('.shouldRestoreCheckBox').each(function() {
						$(this).prop('checked', isChecked);
						$(this).trigger('change');
					});
				})));
				headerRow.append($('<div/>').addClass('cell').text(__('restore.list.restoreAction')));
				restoreList.append(headerRow);
				
				$.each(backedUpFlows, function(i, backedUpFlow) {
					var flowRow = $('<div/>').addClass('row').data('backedUpFlow', backedUpFlow);
					
					flowRow.append($('<div/>').addClass('cell').text(getFolderPath(backedUpFolders, backedUpFlow.folder)));
					flowRow.append($('<div/>').addClass('cell').text(backedUpFlow.title));
					flowRow.append($('<div/>').addClass('cell').addFolderSelector(currentFolders, backedUpFlow.folder));
					flowRow.append($('<div/>').addClass('cell').append($('<input/>').attr('type','checkbox').addClass('shouldRestoreCheckBox').prop('checked',true).change(function(){
						$(this).parent().parent().removeClass('disabled');
						if (!$(this).prop('checked'))
							$(this).parent().parent().addClass('disabled');
					})));
					flowRow.append($('<div/>').addClass('cell').addFlowActionSelector());
					
					restoreList.append(flowRow);
					flowRow.setFlowActions(true);
				});
			}
		});
	});
};

$.fn.addFlowActionSelector = function() {
	var container = $(this);
	var selector = $('<select/>').addClass('flowActionSelector');
	container.append(selector);
	selector.append($('<option/>').val('copyToNewFlow').text(__('restore.list.copyToNewFlow')));
	selector.append($('<option/>').val('overwriteExistingFlow').text(__('restore.list.overwriteExistingFlow')));
	return container;
};

$.fn.addFolderSelector = function(folders, selectedFolderId) {
	var container = $(this);
	var selector = $('<select/>').addClass('folderSelector');
	container.append(selector);
	selector.append($('<option/>').val('').text('/'));
	selector.addFoldersToSelector(folders, false, selectedFolderId, 0);
	selector.change(function() { $(this).parent().parent().setFlowActions(false); });
	
	return container;
};

$.fn.setFlowActions = function(isInitial) {
	var row = $(this);
	var list = row.parent();
	
	var currentFlows = list.data('currentFlows');
	var backedUpFlow = row.data('backedUpFlow');
	
	var folderSelector = row.find('.folderSelector');
	var flowActionSelector = row.find('.flowActionSelector');
	
	var optionOverwriteExistingFlow = flowActionSelector.find('option[value="overwriteExistingFlow"]');
	var optionCopyToNewFlow = flowActionSelector.find('option[value="copyToNewFlow"]');
	
	var overwriteIsSelected = (flowActionSelector.val() == 'overwriteExistingFlow');
	optionOverwriteExistingFlow.removeAttr('disabled');
	
	if (getFlowById(currentFlows, backedUpFlow.id) == null)
		optionOverwriteExistingFlow.attr('disabled', 'disabled');
	else if (folderSelector.val() != backedUpFlow.folder)
		optionOverwriteExistingFlow.attr('disabled', 'disabled');
	if ((optionOverwriteExistingFlow.attr('disabled') == 'disabled') && overwriteIsSelected)
		flowActionSelector.val('copyToNewFlow');
	else if (optionOverwriteExistingFlow.attr('disabled') != 'disabled')
		flowActionSelector.val('overwriteExistingFlow');
	
	if (isInitial) {
		if (optionOverwriteExistingFlow.attr('disabled') != 'disabled')
			optionOverwriteExistingFlow.attr('selected', 'selected');
		else
			optionCopyToNewFlow.attr('selected', 'selected');
	}
};

$.fn.addFoldersToSelector = function(folders, parentFolderId, selectedFolderId, level) {
	var selector = $(this);
	$.each(folders, function(i, folder) {
		if (folder.folder == parentFolderId) {
			var description = '';
			for (var lvl = 0; lvl < level; lvl++)
				description += '&nbsp;&nbsp;&nbsp;';
			description += '/' + folder.title;
			var option = $('<option/>').val(folder.id).html(description);
			if (folder.id == selectedFolderId)
				option.attr('selected', 'selected');
			selector.append(option);
			selector.addFoldersToSelector(folders, folder.id, selectedFolderId, level+1);
		}
	});
};

function getFolderById(folders, folderId) {
	return folderId ? folders[folderId] : null;
};

function getFlowById(flows, flowId) {
	return flowId ? flows[flowId] : null;
};

function getFolderPath(folders, folderId) {
	var folder = getFolderById(folders, folderId);
	if (folder == null) return '/';
	var path = '';
	if (folder.folder && (folder.folder.length > 0))
		path = getFolderPath(folders, folder.folder);
	path += '/' + folder.title;
	return path;
};

function backupAllFlows() {
	retrieveFolders(function(foldersError, foldersResult) {
		if (foldersError) showRetrievalError(foldersError);
		else retrieveFlows(function(flowsError, flowsResult) {
			if (flowsError) showRetrievalError(flowsError);
			else {
				var zip = new JSZip();
				zip.file('folders.json', JSON.stringify(foldersResult.result));
				zip.file('flows.json', JSON.stringify(flowsResult.result));
				zip.generateAsync({type:'blob'}).then(function(content){ saveAs(content, 'homey-flow-backup-'+cleanUpDateString(new Date().toISOString())+'.zip'); });
			}
		});
	});
};

function cleanUpDateString(dateString) {
	var invalidChars = ['-', ':', 'Z', '.'];
	$.each(invalidChars, function(i, invalidChar) {
		while (dateString.indexOf(invalidChar) >= 0)
			dateString = dateString.replace(invalidChar, '');
	});
	return dateString.replace('T', '-');
};

function retrieveFlows(callback) {
	retrieveDataFromHomey('/api/manager/flow/flow/', function(err, result) {
		if (err)
			callback(err, null);
		else
			callback(null, result);
	});
};

function retrieveFolders(callback) {
	retrieveDataFromHomey('/api/manager/flow/Folder/', function(err, result) {
		if (err)
			callback(err, null);
		else
			callback(null, result);
	});
};

function retrieveDataFromHomey(path, callback) {
	$.ajax({
		type: 'GET',
		url: path,
		dataType: 'json',
		headers: { 'Authorization': 'Bearer ' + $('#textBearerToken').val() },
		error: function(req, status) { if (status == null) status = ''; callback(status, null); },
		success: function(flowsData) { callback(null, flowsData); }
	});
};

function hasBearerTokenConfigured() {
	return ($('#textBearerToken').val() != null) && ($('#textBearerToken').val().length > 0);
};

function showRetrievalError(status) {
	var errorMessage =__('retrievalError');
	if ((status != null) && (status.length > 0))
		errorMessage += '\nError: ' + status;
	showErrorMessages([errorMessage]);
};

function showError(errorMessage) {
	showErrorMessages([errorMessage]);
};

function createGuid() { 
	var s4 = function() { return (((1+Math.random())*0x10000)|0).toString(16).substring(1); };
	return (s4() + s4() + "-" + s4() + "-4" + s4().substr(0,3) + "-" + s4() + "-" + s4() + s4() + s4()).toLowerCase();
};

// Load & show popup
function loadPopup(id, selector, zIndex, positionTop, width, height){
	$('body').css('overflow','hidden');
	var popupBackground = $('<div>').addClass('popupBackground').attr('id', id+'Background').css('height', $('body').height());
	popupBackground.css('z-index', zIndex-1);
	var popupContainer = $('<div>').addClass('popupContainer').attr('id', id);
	if (selector != null)
		popupContainer.html(selector.html());
	popupContainer.find('.closePopup').click(function(){ popupContainer.closePopup(); });
	popupContainer.css('z-index', zIndex);
	popupContainer.css('top', positionTop + 'px');
	popupContainer.css('width', 'calc('+width+'px - 40px)');
	popupContainer.css('height', 'calc('+height+'px - 40px)');
	popupContainer.css('margin', '0 0 0 -'+(width/2)+'px');
	$('body').append(popupBackground);
	$('body').append(popupContainer);
	return popupContainer;
};

// Close a popup
$.fn.closePopup = function(){
	var popupContainer = $(this);
	var popupId = popupContainer.attr('id');
	var popupBackground = $('#'+popupId+'Background');
	popupContainer.remove();
	popupBackground.remove();
	$('body').css('overflow','auto');
};

function showErrorMessages(errorMessages, popupWidth, popupHeight) {
	if (popupWidth == null)
		popupWidth = 300;
	if (popupHeight == null)
		popupHeight = 200;
	var popupContainer = loadPopup(createGuid(), null, 9999, 100, popupWidth, popupHeight);
	var errorContainer = $('<div/>');
	if (errorMessages.length == 1) {
		errorContainer.append($('<p/>').addClass('errorMessages').html(errorMessages[0]));
	} else {
		errorList = $('<ul/>').addClass('errorMessages');
		$.each(errorMessages, function(i, errorMessage) {
			errorList.append($('<li/>').text(errorMessage));
		});
		errorContainer.append(errorList);
	}
	popupContainer.append(errorContainer);
	var bottomBar = $('<div/>').addClass('bottomButtonBar');
	bottomBar.append($('<button/>').addClass('floatRight').text(__('close')).click(function(e) {
		e.preventDefault();
		popupContainer.closePopup();
	}));
	popupContainer.append(bottomBar);
}

function showErrorMessagesWithSelector(selector, popupWidth, popupHeight) {
	if (popupWidth == null)
		popupWidth = 300;
	if (popupHeight == null)
		popupHeight = 200;
	var popupContainer = loadPopup(createGuid(), null, 9999, 100, popupWidth, popupHeight);
	popupContainer.append(selector);
	var bottomBar = $('<div/>').addClass('bottomButtonBar');
	bottomBar.append($('<button/>').addClass('floatRight').text(__('close')).click(function(e) {
		e.preventDefault();
		popupContainer.closePopup();
	}));
	popupContainer.append(bottomBar);
}