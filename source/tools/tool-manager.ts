import { ToolConfig, ToolConfiguration, ToolManagerSettings } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class ToolManager {
    private settings: ToolManagerSettings;
    private availableTools: ToolConfig[] = [];

    constructor() {
        this.settings = this.readToolManagerSettings();
        this.initializeAvailableTools();
        this.reconcileConfigurations();

        // 如果没有配置，自动创建一个默认配置
        if (this.settings.configurations.length === 0) {
            console.log('[ToolManager] No configurations found, creating default configuration...');
            this.createConfiguration('默认配置', '自动创建的默认工具配置');
        }
    }

    private getToolManagerSettingsPath(): string {
        return path.join(Editor.Project.path, 'settings', 'tool-manager.json');
    }

    private ensureSettingsDir(): void {
        const settingsDir = path.dirname(this.getToolManagerSettingsPath());
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }
    }

    private readToolManagerSettings(): ToolManagerSettings {
        const DEFAULT_TOOL_MANAGER_SETTINGS: ToolManagerSettings = {
            configurations: [],
            currentConfigId: '',
            maxConfigSlots: 5
        };

        try {
            this.ensureSettingsDir();
            const settingsFile = this.getToolManagerSettingsPath();
            if (fs.existsSync(settingsFile)) {
                const content = fs.readFileSync(settingsFile, 'utf8');
                return { ...DEFAULT_TOOL_MANAGER_SETTINGS, ...JSON.parse(content) };
            }
        } catch (e) {
            console.error('Failed to read tool manager settings:', e);
        }
        return DEFAULT_TOOL_MANAGER_SETTINGS;
    }

    private saveToolManagerSettings(settings: ToolManagerSettings): void {
        try {
            this.ensureSettingsDir();
            const settingsFile = this.getToolManagerSettingsPath();
            fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        } catch (e) {
            console.error('Failed to save tool manager settings:', e);
            throw e;
        }
    }

    private exportToolConfiguration(config: ToolConfiguration): string {
        return JSON.stringify(config, null, 2);
    }

    private importToolConfiguration(configJson: string): ToolConfiguration {
        try {
            const config = JSON.parse(configJson);
            // 验证配置格式
            if (!config.id || !config.name || !Array.isArray(config.tools)) {
                throw new Error('Invalid configuration format');
            }
            return config;
        } catch (e) {
            console.error('Failed to parse tool configuration:', e);
            throw new Error('Invalid JSON format or configuration structure');
        }
    }

    private initializeAvailableTools(): void {
        try {
            const { SceneTools } = require('./scene-tools');
            const { NodeTools } = require('./node-tools');
            const { ComponentTools } = require('./component-tools');
            const { PrefabTools } = require('./prefab-tools');
            const { ProjectTools } = require('./project-tools');
            const { DebugTools } = require('./debug-tools');
            const { PreferencesTools } = require('./preferences-tools');
            const { ServerTools } = require('./server-tools');
            const { BroadcastTools } = require('./broadcast-tools');
            const { SceneAdvancedTools } = require('./scene-advanced-tools');
            const { SceneViewTools } = require('./scene-view-tools');
            const { ReferenceImageTools } = require('./reference-image-tools');
            const { AssetAdvancedTools } = require('./asset-advanced-tools');
            const { ValidationTools } = require('./validation-tools');
            const { GroupedTools } = require('./grouped-tools');

            const tools = {
                scene: new SceneTools(),
                node: new NodeTools(),
                component: new ComponentTools(),
                prefab: new PrefabTools(),
                project: new ProjectTools(),
                debug: new DebugTools(),
                preferences: new PreferencesTools(),
                server: new ServerTools(),
                broadcast: new BroadcastTools(),
                sceneAdvanced: new SceneAdvancedTools(),
                sceneView: new SceneViewTools(),
                referenceImage: new ReferenceImageTools(),
                assetAdvanced: new AssetAdvancedTools(),
                validation: new ValidationTools()
            };

            const groupedTools = new GroupedTools(tools);
            this.availableTools = groupedTools.getTools().map((tool: any) => ({
                category: 'mcp',
                name: tool.name,
                enabled: true,
                description: tool.description
            }));

            console.log(`[ToolManager] Initialized ${this.availableTools.length} grouped tools from MCP server`);
        } catch (error) {
            console.error('[ToolManager] Failed to initialize grouped tools from MCP server:', error);
            this.initializeDefaultTools();
        }
    }

    private initializeDefaultTools(): void {
        const fallbackTools = [
            'scene_management',
            'scene_hierarchy',
            'node_lifecycle',
            'node_query',
            'node_transform',
            'component_manage',
            'component_query',
            'component_property',
            'component_script',
            'prefab_browse',
            'prefab_lifecycle',
            'prefab_instance',
            'project_manage',
            'project_asset',
            'project_build',
            'debug_console',
            'debug_logs',
            'preferences_manage',
            'server_info',
            'broadcast_message',
            'scene_property',
            'scene_clipboard',
            'scene_execution',
            'scene_view_control',
            'reference_image_manage',
            'reference_image_view',
            'asset_manage',
            'asset_analyze',
            'validation_utils'
        ];

        this.availableTools = fallbackTools.map(name => ({
            category: 'mcp',
            name,
            enabled: true,
            description: `Grouped MCP tool: ${name}`
        }));

        console.log(`[ToolManager] Initialized ${this.availableTools.length} fallback grouped tools`);
    }

    public getAvailableTools(): ToolConfig[] {
        return [...this.availableTools];
    }

    public getConfigurations(): ToolConfiguration[] {
        return [...this.settings.configurations];
    }

    public getCurrentConfiguration(): ToolConfiguration | null {
        if (!this.settings.currentConfigId) {
            return null;
        }
        return this.settings.configurations.find(config => config.id === this.settings.currentConfigId) || null;
    }

    public createConfiguration(name: string, description?: string): ToolConfiguration {
        if (this.settings.configurations.length >= this.settings.maxConfigSlots) {
            throw new Error(`已达到最大配置槽位数量 (${this.settings.maxConfigSlots})`);
        }

        const config: ToolConfiguration = {
            id: this.generateId(),
            name,
            description,
            tools: this.availableTools.map(tool => ({ ...tool })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.settings.configurations.push(config);
        this.settings.currentConfigId = config.id;
        this.saveSettings();

        return config;
    }

    public updateConfiguration(configId: string, updates: Partial<ToolConfiguration>): ToolConfiguration {
        const configIndex = this.settings.configurations.findIndex(config => config.id === configId);
        if (configIndex === -1) {
            throw new Error('配置不存在');
        }

        const config = this.settings.configurations[configIndex];
        const updatedConfig: ToolConfiguration = {
            ...config,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.settings.configurations[configIndex] = updatedConfig;
        this.saveSettings();

        return updatedConfig;
    }

    public deleteConfiguration(configId: string): void {
        const configIndex = this.settings.configurations.findIndex(config => config.id === configId);
        if (configIndex === -1) {
            throw new Error('配置不存在');
        }

        this.settings.configurations.splice(configIndex, 1);

        // 如果删除的是当前配置，清空当前配置ID
        if (this.settings.currentConfigId === configId) {
            this.settings.currentConfigId = this.settings.configurations.length > 0
                ? this.settings.configurations[0].id
                : '';
        }

        this.saveSettings();
    }

    public setCurrentConfiguration(configId: string): void {
        const config = this.settings.configurations.find(config => config.id === configId);
        if (!config) {
            throw new Error('配置不存在');
        }

        this.settings.currentConfigId = configId;
        this.saveSettings();
    }

    public updateToolStatus(configId: string, category: string, toolName: string, enabled: boolean): void {
        console.log(`Backend: Updating tool status - configId: ${configId}, category: ${category}, toolName: ${toolName}, enabled: ${enabled}`);

        const config = this.settings.configurations.find(config => config.id === configId);
        if (!config) {
            console.error(`Backend: Config not found with ID: ${configId}`);
            throw new Error('配置不存在');
        }

        console.log(`Backend: Found config: ${config.name}`);

        const tool = config.tools.find(t => t.category === category && t.name === toolName);
        if (!tool) {
            console.error(`Backend: Tool not found - category: ${category}, name: ${toolName}`);
            throw new Error('工具不存在');
        }

        console.log(`Backend: Found tool: ${tool.name}, current enabled: ${tool.enabled}, new enabled: ${enabled}`);

        tool.enabled = enabled;
        config.updatedAt = new Date().toISOString();

        console.log(`Backend: Tool updated, saving settings...`);
        this.saveSettings();
        console.log(`Backend: Settings saved successfully`);
    }

    public updateToolStatusBatch(configId: string, updates: { category: string; name: string; enabled: boolean }[]): void {
        console.log(`Backend: updateToolStatusBatch called with configId: ${configId}`);
        console.log(`Backend: Current configurations count: ${this.settings.configurations.length}`);
        console.log(`Backend: Current config IDs:`, this.settings.configurations.map(c => c.id));

        const config = this.settings.configurations.find(config => config.id === configId);
        if (!config) {
            console.error(`Backend: Config not found with ID: ${configId}`);
            console.error(`Backend: Available config IDs:`, this.settings.configurations.map(c => c.id));
            throw new Error('配置不存在');
        }

        console.log(`Backend: Found config: ${config.name}, updating ${updates.length} tools`);

        updates.forEach(update => {
            const tool = config.tools.find(t => t.category === update.category && t.name === update.name);
            if (tool) {
                tool.enabled = update.enabled;
            }
        });

        config.updatedAt = new Date().toISOString();
        this.saveSettings();
        console.log(`Backend: Batch update completed successfully`);
    }

    public exportConfiguration(configId: string): string {
        const config = this.settings.configurations.find(config => config.id === configId);
        if (!config) {
            throw new Error('配置不存在');
        }

        return this.exportToolConfiguration(config);
    }

    public importConfiguration(configJson: string): ToolConfiguration {
        const config = this.importToolConfiguration(configJson);

        // 生成新的ID和时间戳
        config.id = this.generateId();
        config.createdAt = new Date().toISOString();
        config.updatedAt = new Date().toISOString();

        if (this.settings.configurations.length >= this.settings.maxConfigSlots) {
            throw new Error(`已达到最大配置槽位数量 (${this.settings.maxConfigSlots})`);
        }

        this.settings.configurations.push(config);
        this.saveSettings();

        return config;
    }

    public getEnabledTools(): ToolConfig[] {
        const currentConfig = this.getCurrentConfiguration();
        if (!currentConfig) {
            return this.availableTools.filter(tool => tool.enabled);
        }
        return currentConfig.tools.filter(tool => tool.enabled);
    }

    public getToolManagerState() {
        const currentConfig = this.getCurrentConfiguration();
        return {
            success: true,
            availableTools: currentConfig ? currentConfig.tools : this.getAvailableTools(),
            selectedConfigId: this.settings.currentConfigId,
            configurations: this.getConfigurations(),
            maxConfigSlots: this.settings.maxConfigSlots
        };
    }

    private reconcileConfigurations(): void {
        if (this.settings.configurations.length === 0) {
            return;
        }

        const availableByKey = new Map(this.availableTools.map(tool => [`${tool.category}:${tool.name}`, tool]));
        let changed = false;

        for (const config of this.settings.configurations) {
            const previousTools = Array.isArray(config.tools) ? config.tools : [];
            const previousByKey = new Map(previousTools.map(tool => [`${tool.category}:${tool.name}`, tool]));
            const matchingOldTools = previousTools.filter(tool => availableByKey.has(`${tool.category}:${tool.name}`));

            if (matchingOldTools.length === 0 || previousTools.length !== this.availableTools.length) {
                config.tools = this.availableTools.map(tool => {
                    const oldTool = previousByKey.get(`${tool.category}:${tool.name}`);
                    return {
                        ...tool,
                        enabled: oldTool ? oldTool.enabled : true
                    };
                });
                config.updatedAt = new Date().toISOString();
                changed = true;
            }
        }

        const currentExists = this.settings.configurations.some(config => config.id === this.settings.currentConfigId);
        if (!currentExists) {
            this.settings.currentConfigId = this.settings.configurations[0]?.id || '';
            changed = true;
        }

        if (changed) {
            this.saveToolManagerSettings(this.settings);
        }
    }

    private generateId(): string {
        const randomPart = Math.random().toString(36).slice(2, 10);
        const timePart = Date.now().toString(36);
        return `${timePart}-${randomPart}`;
    }

    private saveSettings(): void {
        console.log(`Backend: Saving settings, current configs count: ${this.settings.configurations.length}`);
        this.saveToolManagerSettings(this.settings);
        console.log(`Backend: Settings saved to file`);
    }
}
