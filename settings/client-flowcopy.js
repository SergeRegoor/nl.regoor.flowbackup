var FlowCopy = function(homeyFlows) {
	if (homeyFlows == null) return null;
	this._homeyFlows = homeyFlows;
};

FlowCopy.prototype.addFolderSelector = function(container, selectedFolderId, callback) {
	var _class = this;
	var folderSelectorContainer = $('<div/>').addClass('folderSelectorContainer');
	folderSelectorContainer.append($('<p/>').html(__('copy.selectSourceFolder')));
	container.append(folderSelectorContainer);

	var selector = $('<select/>').addClass('folderSelector');
	folderSelectorContainer.append(selector);
	selector.append($('<option/>').val('').text(''));
	selector.append($('<option/>').val('/').text('/'));
	_class.addFoldersToSelector(selector, false, selectedFolderId, 0);
	selector.change(function() { callback(selector.find('option:selected').val()); });
};

FlowCopy.prototype.addFoldersToSelector = function(selector, parentFolderId, selectedFolderId, level) {
	var _class = this;
	$.each(_class._homeyFlows._folders, function(i, folder) {
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

FlowCopy.prototype.addFlowList = function(container, selectedFolderId) {
	var _class = this;
	var list = container.find('.flowList');
	list.remove();
	
	list = $('<div/>').addClass('list flowList');
	var headerRow = $('<div/>').addClass('row head');
	headerRow.append($('<div/>').addClass('cell').text(' '));
	headerRow.append($('<div/>').addClass('cell').text('Flow title'));
	list.append(headerRow);
	
	$.each(_class._homeyFlows._flows, function(i, flow) {
		if ((flow.folder && (flow.folder == selectedFolderId)) || (!flow.folder && (selectedFolderId == '/'))) {
			var row = $('<div/>').addClass('row');
			row.append($('<div/>').addClass('cell').append($('<input/>').attr('type', 'checkbox').val(flow.id).attr('id', 'flowSel'+flow.id)));
			row.append($('<div/>').addClass('cell').append($('<label/>').attr('for', 'flowSel'+flow.id).text(flow.title)));
			list.append(row);
		}
	});
	
	if (list.find('.row:not(.head)').length > 0) {
		container.append(list);
		return list;
	}
	return null;
};

FlowCopy.prototype.addDestinationFolderSelector = function(container, selectedFolderId, callback) {
	var _class = this;
	var folderSelectorContainer = container.find('.destinationFolderSelectorContainer');
	folderSelectorContainer.remove();
	
	folderSelectorContainer = $('<div/>').addClass('destinationFolderSelectorContainer');
	folderSelectorContainer.append($('<p/>').html(__('copy.selectDestinationFolder')));
	container.append(folderSelectorContainer);

	var selector = $('<select/>').addClass('destinationFolderSelector');
	folderSelectorContainer.append(selector);
	selector.append($('<option/>').val('/').text('/'));
	_class.addFoldersToSelector(selector, false, selectedFolderId, 0);
	
	var button = $('<button/>').addClass('copyButton').html(__('copy.copyButton'));
	folderSelectorContainer.append(button);
	button.click(function() { callback(selector.find('option:selected').val()); });
};

FlowCopy.prototype.getSelectedFlowsIdsFromList = function(flowList) {
	var flowIds = [];
	flowList.find('input[type="checkbox"]:checked').each(function(){ flowIds.push($(this).val()); });
	return flowIds;
};

FlowCopy.prototype.copyFlowsTo = function(flowIds, destinationFolderId, callback) {
	var _class = this;
	var homeyRestore = new HomeyRestore(this._homeyFlows);
	var flowsToCreate = [];
	
	if (!destinationFolderId || (destinationFolderId == '/'))
		destinationFolderId = false;
	
	$.each(flowIds, function(i, flowId) {
		var flow = _class._homeyFlows.getFlowById(flowId);
		if (flow != null) {
			var flowToCreate = {
				folderId: destinationFolderId,
				backedUpFlow: flow,
				flowId: createGuid(),
				title: __('copy.copyPrefix') + ' ' + flow.title
			};
			flowsToCreate.push(flowToCreate);
		}
	});
	
	if (flowsToCreate.length != flowIds.length)
		callback({successful:false, errorMessages:[__('copy.couldNotFindFlowsError')]});
	else {
		homeyRestore._createFlows(flowsToCreate, function(result) {
			if (!result.successful)
				callback(result);
			else
				homeyRestore._overwriteFlows(flowsToCreate, function(result) { callback(result); });
		});
	}
};