var RestoreList = function(homeyFlows, backUp) {
	if ((homeyFlows == null) || !homeyFlows.isOk() || (backUp == null) || (backUp.folders == null) || (backUp.flows == null) || (backUp.info == null)) return null;
	this._current = homeyFlows;
	this._backUp = backUp;
};

RestoreList.prototype.render = function(container) {
	var _class = this;
	container.empty();
	container.data('current', this._current);
	container.data('backUp', this._backUp);
	
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
	container.append(headerRow);
	
	$.each(this._backUp.flows, function(i, backedUpFlow) {
		var flowRow = $('<div/>').addClass('row').data('backedUpFlow', backedUpFlow);
		container.append(flowRow);
		
		flowRow.append($('<div/>').addClass('cell folderName').text(_class._backUp.getFolderPath(backedUpFlow.folder)));
		flowRow.append($('<div/>').addClass('cell flowTitle').text(backedUpFlow.title));
		var folderSelectorCell = $('<div/>').addClass('cell');
		flowRow.append(folderSelectorCell);
		_class.addFolderSelector(folderSelectorCell, backedUpFlow.folder);
		flowRow.append($('<div/>').addClass('cell').append($('<input/>').attr('type','checkbox').addClass('shouldRestoreCheckBox').prop('checked',true).change(function(){
			$(this).parent().parent().removeClass('disabled');
			if (!$(this).prop('checked'))
				$(this).parent().parent().addClass('disabled');
		})));
		var flowActionCell = $('<div/>').addClass('cell');
		flowRow.append(flowActionCell);
		_class.addFlowActionSelector(flowActionCell);
		flowRow.setFlowActions(true);
	});
	
	container.find('.row:not(.head)').sort(function(a, b) {
		var rowA = $(a);
		var rowB = $(b);
		var folderNameA = rowA.find('.folderName').text();
		var folderNameB = rowB.find('.folderName').text();
		var folderCompareResult = folderNameA.localeCompare(folderNameB);
		if (folderCompareResult != 0)
			return folderCompareResult;
		return rowA.find('.flowTitle').text().localeCompare(rowB.find('.flowTitle').text());
	}).appendTo(container);
};

RestoreList.prototype.getFlowsToRestore = function(container) {
	var _class = this;
	var flowsToCreate = [];
	var flowsToOverwrite = [];
		
	container.find('.row:not(.head)').each(function(){
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
				var currentFlow = _class._current.getFlowById(flowToRestore.flowId);
				if (currentFlow != null)
					flowToRestore.title = __('restore.restoreTagInTitle') + ' ' + flowToRestore.title;
				flowToRestore.flowId = createGuid();
				flowsToCreate.push(flowToRestore);
			} else if (row.find('.flowActionSelector').val() == 'overwriteExistingFlow')
				flowsToOverwrite.push(flowToRestore);
		}
	});
	
	return {
		toCreate: flowsToCreate,
		toOverwrite: flowsToOverwrite
	};
};

RestoreList.prototype.addFlowActionSelector = function(container) {
	var selector = $('<select/>').addClass('flowActionSelector');
	container.append(selector);
	selector.append($('<option/>').val('copyToNewFlow').text(__('restore.list.copyToNewFlow')));
	selector.append($('<option/>').val('overwriteExistingFlow').text(__('restore.list.overwriteExistingFlow')));
	return container;
};

RestoreList.prototype.addFolderSelector = function(container, selectedFolderId) {
	var _class = this;
	var selector = $('<select/>').addClass('folderSelector');
	container.append(selector);
	selector.append($('<option/>').val('').text('/'));
	_class.addFoldersToSelector(selector, false, selectedFolderId, 0);
	selector.change(function() { $(this).parent().parent().setFlowActions(false); });
	return container;
};

RestoreList.prototype.addFoldersToSelector = function(selector, parentFolderId, selectedFolderId, level) {
	var _class = this;
	$.each(selector.parent().parent().parent().data('current')._folders, function(i, folder) {
		if (folder.folder == parentFolderId) {
			var description = '';
			for (var lvl = 0; lvl < level; lvl++)
				description += '&nbsp;&nbsp;&nbsp;';
			description += '/' + folder.title;
			var option = $('<option/>').val(folder.id).html(description);
			if (folder.id == selectedFolderId)
				option.attr('selected', 'selected');
			selector.append(option);
			_class.addFoldersToSelector(selector, folder.id, selectedFolderId, level+1);
		}
	});
};

$.fn.setFlowActions = function(isInitial) {
	var row = $(this);
	var list = row.parent();
	
	var currentFlows = list.data('current')._flows;
	var backedUpFlow = row.data('backedUpFlow');
	
	var folderSelector = row.find('.folderSelector');
	var flowActionSelector = row.find('.flowActionSelector');
	
	var optionOverwriteExistingFlow = flowActionSelector.find('option[value="overwriteExistingFlow"]');
	var optionCopyToNewFlow = flowActionSelector.find('option[value="copyToNewFlow"]');
	
	var overwriteIsSelected = (flowActionSelector.val() == 'overwriteExistingFlow');
	optionOverwriteExistingFlow.removeAttr('disabled');
	
	if (row.parent().data('current').getFlowById(backedUpFlow.id) == null)
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