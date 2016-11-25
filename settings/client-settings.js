function onHomeyReady() {
	Homey.get('bearerToken', (error, bearerToken) => { setBearerToken(bearerToken, false); });
	Homey.ready();
};

$(document).ready(() => {
	$('#buttonCopyFlows, #buttonBackupAllFlows, #buttonRestoreFlows, #bearerTokenExplanation').hide();
	$('#fieldSetWarning button').click(() => { showPopupWithSelector($('#warningMessages').html(), 550, 300); });
	$('#buttonSaveBearerToken').click(() => {
		setBearerToken($('#textBearerToken').val(), true);
	});
	$('#buttonBackupAllFlows').click(() => {
		getHomeyFlows((homeyFlows) => {
			var homeyBackUp = new HomeyBackUp(homeyFlows);
			homeyBackUp.createFullBackUp((backUpContent) => {
				saveAs(backUpContent, homeyFlows.getHomeyName()+'-flow-backup-'+new Date().toCleanString()+'.zip');
			});
		});
	});
	$('#buttonRestoreFlows').click(() => {
		selectLocalFile((selectedFile) => {
			getHomeyFlows((homeyFlows) => {
				var homeyBackUp = new HomeyBackUp(homeyFlows);
				homeyBackUp.readBackUpFile(selectedFile, (backUp) => {
					if (backUp == null)
						showErrorMessage(__('restore.readError'));
					else {
						var dateString = backUp.info.backUpDate.toString();
						if (dateString.lastIndexOf('.') >= 0)
							dateString = dateString.substring(0, dateString.lastIndexOf('.'));
						dateString = dateString.replace('T',' &nbsp; ').replace('Z','')
						$('#backUpDate').html(dateString);
						$('#backUpHomeyName').text(backUp.info.homeyName);
						var restoreList = new RestoreList(homeyFlows, backUp);
						restoreList.render($('#restoreList'));
						$('#restoreContainer').show();
					}
				});
			});
		});
	});
	$('#cancelRestoreButton').click(() => { $('#restoreList').empty(); $('#restoreContainer').hide(); });
	$('#performRestoreButton').click(() => {
		getHomeyFlows((homeyFlows) => {
			var restoreList = new RestoreList(homeyFlows, $('#restoreList').data('backUp'));
			var flowsToRestore = restoreList.getFlowsToRestore($('#restoreList'));
			var homeyRestore = new HomeyRestore(homeyFlows);
			homeyRestore.restoreFlows(flowsToRestore, (result) => {
				$('#cancelRestoreButton').trigger('click');
				if (result == null) result = {successful:false};
				if (!result.successful)
					showErrorMessages(result.errorMessage || [__('restore.restoreError')]);
				else
					showErrorMessage(__('restore.restoreMessage'));
			});
		});
	});
	$('#buttonCopyFlows').click(() => {
		getHomeyFlows((homeyFlows) => {
			var popupContainer = $('<div/>');
			var popup = showPopupWithSelector(popupContainer, 500, 350);
			var flowCopy = new FlowCopy(homeyFlows);
			flowCopy.addFolderSelector(popupContainer, null, (selectedFolderId) => {
				var flowList = flowCopy.addFlowList(popupContainer, selectedFolderId);
				flowCopy.addDestinationFolderSelector(popupContainer, selectedFolderId, (destinationFolderId) => {
					var flowIds = flowCopy.getSelectedFlowsIdsFromList(flowList);
					if ((flowIds == null) || (flowIds.length == 0))
						showErrorMessage(__('copy.noFlowsSelectedError'));
					else {
						if (!confirm(__('copy.copyConfirmation').replace('[quantity]', flowIds.length))) return;
						flowCopy.copyFlowsTo(flowIds, destinationFolderId, (result) => {
							if (!result.successful)
								showErrorMessages(result.errorMessages);
							else {
								popup.closePopup();
								showErrorMessage(__('copy.copiedMessage'));
							}
						});
					}
				});
			});
		});
	});
});

function setBearerToken(bearerToken, fromInput) {
	var updateInput = false;
	if (fromInput) {
		if (bearerToken.lastIndexOf('=') >= 0) {
			bearerToken = bearerToken.substring(bearerToken.lastIndexOf('=')+1);
			updateInput = true;
			$('#textBearerToken').val(bearerToken);
		}
		Homey.set('bearerToken', bearerToken);
	} else
		updateInput = true;
	if (updateInput)
		$('#textBearerToken').val(bearerToken);
	
	$('#buttonCopyFlows, #buttonBackupAllFlows, #buttonRestoreFlows').hide();
	$('#bearerTokenExplanation').show();
	if ((bearerToken != null) && (bearerToken.length > 0)) {
		$('#buttonCopyFlows, #buttonBackupAllFlows, #buttonRestoreFlows').show();
		$('#bearerTokenExplanation').hide();
	}
};

function getHomeyFlows(callback) {
	var homeyFlows = new HomeyFlows($('#textBearerToken').val());
	$.when(homeyFlows.isReady).done(() => {
		if (!homeyFlows.isOk())
			showErrorMessage(homeyFlows.errorMessage);
		else
			callback(homeyFlows);
	});
};

function selectLocalFile(callback) {
	var fileSelector = $('<input/>').attr('type', 'file');
	fileSelector.change((e) => {
		var selectedFile = fileSelector.prop('files')[0];
		callback(selectedFile);
	});
	fileSelector.trigger('click');
};

Date.prototype.toCleanString = function() {
	var localTime = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000));
	var dateString = localTime.toISOString();
	var invalidChars = ['-', ':', 'Z', '.'];
	$.each(invalidChars, (i, invalidChar) => {
		while (dateString.indexOf(invalidChar) >= 0)
			dateString = dateString.replace(invalidChar, '');
	});
	return dateString.replace('T', '-');
};

function createGuid() { 
	var s4 = () => { return (((1+Math.random())*0x10000)|0).toString(16).substring(1); };
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
	popupContainer.find('.closePopup').click(() => { popupContainer.closePopup(); });
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

function showErrorMessage(errorMessage, popupWidth, popupHeight) {
	return showErrorMessages([errorMessage]);
};

function showErrorMessages(errorMessages, popupWidth, popupHeight) {
	var errorContainer = $('<div/>');
	if (errorMessages.length == 1) {
		errorContainer.append($('<p/>').addClass('errorMessages').html(errorMessages[0]));
	} else {
		errorList = $('<ul/>').addClass('errorMessages');
		$.each(errorMessages, (i, errorMessage) => {
			errorList.append($('<li/>').text(errorMessage));
		});
		errorContainer.append(errorList);
	}
	return showPopupWithSelector(errorContainer, popupWidth, popupHeight);
}

function showPopupWithSelector(selector, popupWidth, popupHeight) {
	if (popupWidth == null)
		popupWidth = 300;
	if (popupHeight == null)
		popupHeight = 200;
	var popupContainer = loadPopup(createGuid(), null, 9999, 100, popupWidth, popupHeight);
	popupContainer.append(selector);
	var bottomBar = $('<div/>').addClass('bottomButtonBar');
	bottomBar.append($('<button/>').addClass('floatRight').text(__('close')).click((e) => { popupContainer.closePopup(); }));
	popupContainer.append(bottomBar);
	return popupContainer;
}