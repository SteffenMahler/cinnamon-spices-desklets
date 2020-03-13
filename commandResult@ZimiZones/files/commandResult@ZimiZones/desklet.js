/* global imports */
const Cinnamon = imports.gi.Cinnamon;
const Desklet = imports.ui.desklet;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Util = imports.misc.util;
const uuid = "commandResult@ZimiZones";

// l10n/translation support

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(uuid, str);
}

function MyDesklet(metadata, deskletId) {
    this._init(metadata, deskletId);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init(metadata, deskletId) {
        Desklet.Desklet.prototype._init.call(this, metadata, deskletId);

        this.setHeader(_("Command result"));
        this.updateId = null;
        this.updateInProgress = false;

        try {
            this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], this.instance_id);

            this.settings.bind("delay", "delay", this.onSettingChanged);
            this.settings.bind("timeout", "timeout", this.onSettingChanged);
            this.settings.bind("commands", "commands", this.onSettingChanged);

            this.settings.bind("font-size", "fontSize", this.onFontSettingChanged);
        } 
        catch (e) {
            global.logError(e);
        } 

        this.onSettingChanged();
    },

    onSettingChanged() {
        // Avoid accidently having more than one Mainloop timeout active at a time
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;

        if (this.updateId > 0) {
            Mainloop.source_remove(this.updateId);
        }

        this._content = new St.BoxLayout({
            vertical: true
        });
        this.onFontSettingChanged();
        this.setContent(this._content);
        for(let command of this.commands){
            command.loading = false;
            this._addLabel(command, command.label, "Loading...");
        }

        this._update();
        this.updateInProgress = false;
    },

    onFontSettingChanged() {
        this._content.style = "font-size: " + this.fontSize + "pt;";
    },

    onDeskletClicked(event) {  
        this._update();
    },

    onDeskletRemoved() {
        if (this.updateId > 0) {
            Mainloop.source_remove(this.updateId);
        }
    },

    /**
     * Display new command results
     **/
    _update() {
        this._getCommandResult();
        this.updateId = Mainloop.timeout_add_seconds(this.delay * 60, Lang.bind(this, this._update));
    },

    /**
     * Call command from settings
     **/
    _getCommandResult() {
        for(let command of this.commands){
            if(!command.loading){
                command.labels.label.set_text(command.label);
                command.labels.result.set_text("Loading...");
                command.loading = true;

                Util.spawn_async(["/bin/bash", "-c", "timeout -k " + this.timeout + " " + this.timeout + " " + command.command + " || echo \"Timeout or error occured.\""], Lang.bind(this, this._setNewCommandResult, command));
            }
        }
    },

    /**
     * Callback for _getCommandResult to set the command result when spawn_async returns
     **/
    _setNewCommandResult(result, command) {
        if(result[result.length - 1] === "\n"){
            result = result.slice(0, -1);
        }

        command.loading = false;
        command.labels.label.set_text(command.label);
        command.labels.result.set_text(result);
    },

    _addLabel(command, left, right) {
        command.labels = {
            label: new St.Label({
                text: left
            }),
            result: new St.Label({
                style_class: "command-result-result-label-container",
                text: right
            })
        };

        let box = new St.BoxLayout({
        });
        box.add(command.labels.label, {
        });
        box.add(command.labels.result, {
            expand: true
        });

        this._content.add(box, { 
        });
    }
};

function main(metadata, deskletId) {
    return new MyDesklet(metadata, deskletId);
}
