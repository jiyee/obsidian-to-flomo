import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface Settings {
	flomoAPI: string;
}

const DEFAULT_SETTINGS: Settings = {
	flomoAPI: ''
}

export default class ObsidianToFlomo extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'send-to-flome-all',
			name: 'Send current content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view instanceof MarkdownView && this.checkSettings()) {
					const content = view.getViewData();
					if (content) {
						new FlomoAPI(this.app, this).sendRequest(content,'The current content has been sent to Flomo');
					} else {
						new Notice('No file is currently open. Please open a file and try again.');
					}
				}
			}
		});

		this.addCommand({
			id: 'send-to-flome-selected',
			name: 'Send selected content to Flomo',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view instanceof MarkdownView && this.checkSettings()) {
					const selectedText = editor.getSelection();
					if (selectedText) {
						new FlomoAPI(this.app, this).sendRequest(selectedText,'The selection has been sent to Flomo');
					} else {
						new Notice('No text selected. Please select some text and try again.');
					}
				}
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	checkSettings() {
		if (this.settings.flomoAPI == '') {
			new Notice('Please set Flomo API first');
			return false;
		}
		return true;
	}
}

class FlomoAPI {
	plugin: ObsidianToFlomo;

	constructor(app: App, plugin: ObsidianToFlomo) {
		this.plugin = plugin;
	}

	async sendRequest(text: string, successMsg: string) {
		const imageList = this.extractImages(text);
		text = this.removeImageNotations(text);

		const xhr = new XMLHttpRequest();
		xhr.open("POST",this.plugin.settings.flomoAPI);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.timeout = 5000; // Set timeout to 5 seconds
		xhr.send(JSON.stringify({
			"content": text,
			'image_urls': imageList,
		}));
		xhr.onreadystatechange = this.handleResponse.bind(this, successMsg, xhr);
		xhr.onerror = () => {
			new Notice('Network error, please check your connection');
		};
		xhr.ontimeout = () => {
			new Notice('Request timed out, please try again later');
		};
	}

	extractImages(text) {
		const regex = /!\[\[(.*?)\]\]/g;
		const matches = text.matchAll(regex);
		const imageList = [];
		for (const match of matches) {
			const image = match[1];
			imageList.push(image);
		}
		return imageList;
	}

	removeImageNotations(text) {
		return text.replace(/!\[\[(.*?)\]\]/g, '');
	}

	handleResponse(successMsg, xhr) {
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				try {
					const json = JSON.parse(xhr.responseText);
					if (json.code == 0) {
						new Notice(successMsg);
					}
					else {
						new Notice(json.message + 'please check your settings');
					}
				}
				catch (e) {
					new Notice('please check your settings');
				}
			} else {
				new Notice('Request failed with status code ' + xhr.status);
			}
		}
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ObsidianToFlomo;

	constructor(app: App, plugin: ObsidianToFlomo) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings'});

		new Setting(containerEl)
			.setName('Flomo API')
			.setDesc('The plugin does not save your API key, it is only used to send requests.')
			.addText(text => text
				.setPlaceholder('https://flomoapp.com/iwh/xxxxxx/xxxxxx/')
				.setValue(this.plugin.settings.flomoAPI)
				.onChange(async (value) => {
					this.plugin.settings.flomoAPI = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('button', {text: 'Send a test request'}).addEventListener('click', () => {
			new FlomoAPI(this.app, this.plugin).sendRequest('This is a test request', 'The test request has been sent to Flomo');
		});
	}
}
