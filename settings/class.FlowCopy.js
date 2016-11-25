class FlowCopy {
	constructor(homeyFlows) {
		if (homeyFlows == null) return null;
		this._homeyFlows = homeyFlows;
	}

	addFolderSelector(container, selectedFolderId, callback) {
		var folderSelectorContainer = $('<div/>').addClass('folderSelectorContainer');
		folderSelectorContainer.append($('<p/>').html(__('copy.selectSourceFolder')));
		container.append(folderSelectorContainer);

		var selector = $('<select/>').addClass('folderSelector');
		folderSelectorContainer.append(selector);
		selector.append($('<option/>').val('').text(''));
		selector.append($('<option/>').val('/').text('/'));
		this.addFoldersToSelector(selector, false, selectedFolderId, 0);
		selector.change(() => { callback(selector.find('option:selected').val()); });
	}

	addFoldersToSelector(selector, parentFolderId, selectedFolderId, level) {
		$.each(this._homeyFlows._folders, (i, folder) => {
			if (folder.folder == parentFolderId) {
				var description = '';
				for (var lvl = 0; lvl < level; lvl++)
					description += '&nbsp;&nbsp;&nbsp;';
				description += '/' + folder.title;
				var option = $('<option/>').val(folder.id).html(description);
				if (folder.id == selectedFolderId)
					option.attr('selected', 'selected');
				selector.append(option);
				this.addFoldersToSelector(selector, folder.id, selectedFolderId, level+1);
			}
		});
	}

	addFlowList(container, selectedFolderId) {
		var list = container.find('.flowList');
		list.remove();
		
		list = $('<div/>').addClass('list flowList');
		var headerRow = $('<div/>').addClass('row head');
		headerRow.append($('<div/>').addClass('cell').text(' '));
		headerRow.append($('<div/>').addClass('cell').text('Flow title'));
		list.append(headerRow);
		
		$.each(this._homeyFlows._flows, (i, flow) => {
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
	}

	addDestinationFolderSelector(container, selectedFolderId, callback) {
		var folderSelectorContainer = container.find('.destinationFolderSelectorContainer');
		folderSelectorContainer.remove();
		
		folderSelectorContainer = $('<div/>').addClass('destinationFolderSelectorContainer');
		folderSelectorContainer.append($('<p/>').html(__('copy.selectDestinationFolder')));
		container.append(folderSelectorContainer);

		var selector = $('<select/>').addClass('destinationFolderSelector');
		folderSelectorContainer.append(selector);
		selector.append($('<option/>').val('/').text('/'));
		this.addFoldersToSelector(selector, false, selectedFolderId, 0);
		
		var button = $('<button/>').addClass('copyButton').html(__('copy.copyButton'));
		folderSelectorContainer.append(button);
		button.click(() => { callback(selector.find('option:selected').val()); });
	}

	getSelectedFlowsIdsFromList(flowList) {
		var flowIds = [];
		flowList.find('input[type="checkbox"]:checked').each((i, cb) => { flowIds.push($(cb).val()); });
		return flowIds;
	}

	copyFlowsTo(flowIds, destinationFolderId, callback) {
		var homeyRestore = new HomeyRestore(this._homeyFlows);
		var flowsToCreate = [];
		
		if (!destinationFolderId || (destinationFolderId == '/'))
			destinationFolderId = false;
		
		$.each(flowIds, (i, flowId) => {
			var flow = this._homeyFlows.getFlowById(flowId);
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
			homeyRestore._createFlows(flowsToCreate, (result) => {
				if (!result.successful)
					callback(result);
				else
					homeyRestore._overwriteFlows(flowsToCreate, (result) => { callback(result); });
			});
		}
	}
}