import { ToolDefinition, ToolResponse, ToolExecutor, SceneInfo } from '../types';

export class SceneTools implements ToolExecutor {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'get_current_scene',
                description: 'Get current scene information',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'get_scene_list',
                description: 'Get all scenes in the project',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'open_scene',
                description: 'Open a scene by path',
                inputSchema: {
                    type: 'object',
                    properties: {
                        scenePath: {
                            type: 'string',
                            description: 'The scene file path'
                        }
                    },
                    required: ['scenePath']
                }
            },
            {
                name: 'save_scene',
                description: 'Save current scene',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'create_scene',
                description: 'Create a new scene asset',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sceneName: {
                            type: 'string',
                            description: 'Name of the new scene'
                        },
                        savePath: {
                            type: 'string',
                            description: 'Path to save the scene (e.g., db://assets/scenes/NewScene.scene)'
                        }
                    },
                    required: ['sceneName', 'savePath']
                }
            },
            {
                name: 'save_scene_as',
                description: 'Save scene as new file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Path to save the scene'
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'close_scene',
                description: 'Close current scene',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'get_scene_hierarchy',
                description: 'Get the complete hierarchy of current scene',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeComponents: {
                            type: 'boolean',
                            description: 'Include component information',
                            default: false
                        }
                    }
                }
            }
        ];
    }

    async execute(toolName: string, args: any): Promise<ToolResponse> {
        switch (toolName) {
            case 'get_current_scene':
                return await this.getCurrentScene();
            case 'get_scene_list':
                return await this.getSceneList();
            case 'open_scene':
                return await this.openScene(args.scenePath);
            case 'save_scene':
                return await this.saveScene();
            case 'create_scene':
                return await this.createScene(args.sceneName, args.savePath);
            case 'save_scene_as':
                return await this.saveSceneAs(args.path);
            case 'close_scene':
                return await this.closeScene();
            case 'get_scene_hierarchy':
                return await this.getSceneHierarchy(args.includeComponents);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    private async getCurrentScene(): Promise<ToolResponse> {
        return new Promise((resolve) => {
            // 直接使用 query-node-tree 来获取场景信息（这个方法已经验证可用）
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                if (tree && tree.uuid) {
                    resolve({
                        success: true,
                        data: {
                            name: tree.name || 'Current Scene',
                            uuid: tree.uuid,
                            type: tree.type || 'cc.Scene',
                            active: tree.active !== undefined ? tree.active : true,
                            nodeCount: tree.children ? tree.children.length : 0
                        }
                    });
                } else {
                    resolve({ success: false, error: 'No scene data available' });
                }
            }).catch((err: Error) => {
                // 备用方案：使用场景脚本
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getCurrentSceneInfo',
                    args: []
                };

                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    resolve(result);
                }).catch((err2: Error) => {
                    resolve({ success: false, error: `Direct API failed: ${err.message}, Scene script failed: ${err2.message}` });
                });
            });
        });
    }

    private async getSceneList(): Promise<ToolResponse> {
        return new Promise((resolve) => {
            // Note: query-assets API corrected with proper parameters
            Editor.Message.request('asset-db', 'query-assets', {
                pattern: 'db://assets/**/*.scene'
            }).then((results: any[]) => {
                const scenes: SceneInfo[] = results.map(asset => ({
                    name: asset.name,
                    path: asset.url,
                    uuid: asset.uuid
                }));
                resolve({ success: true, data: scenes });
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    private async openScene(scenePath: string): Promise<ToolResponse> {
        return new Promise(async (resolve) => {
            try {
                const sceneUuid = scenePath.startsWith('db://') || scenePath.endsWith('.scene')
                    ? await Editor.Message.request('asset-db', 'query-uuid', scenePath)
                    : scenePath;

                if (!sceneUuid) {
                    resolve({ success: false, error: `Scene not found: ${scenePath}` });
                    return;
                }

                await Editor.Message.request('scene', 'open-scene', sceneUuid);
                await new Promise(wait => setTimeout(wait, 200));
                const currentScene = await this.getCurrentScene();
                resolve({
                    success: true,
                    message: `Scene opened: ${scenePath}`,
                    data: currentScene.data || { uuid: sceneUuid, path: scenePath }
                });
            } catch (err: any) {
                resolve({
                    success: false,
                    error: `Failed to open scene '${scenePath}': ${err.message}`
                });
            }
        });
    }

    private async saveScene(): Promise<ToolResponse> {
        return new Promise(async (resolve) => {
            try {
                await Editor.Message.request('scene', 'save-scene');
                const currentScene = await this.getCurrentScene();
                resolve({
                    success: true,
                    message: 'Scene saved successfully',
                    data: currentScene.data
                });
            } catch (err: any) {
                resolve({
                    success: false,
                    error: `Failed to save current scene: ${err.message}`
                });
            }
        });
    }

    private async createScene(sceneName: string, savePath: string): Promise<ToolResponse> {
        return new Promise(async (resolve) => {
            const fullPath = this.normalizeScenePath(sceneName, savePath);

            try {
                await this.createEditorScene();
                await this.ensureDefaultSceneNodes();
                await this.saveSceneToPath(fullPath);
                await new Promise(wait => setTimeout(wait, 300));

                const uuid = await Editor.Message.request('asset-db', 'query-uuid', fullPath);
                const sceneList = await this.getSceneList();
                const createdScene = sceneList.data?.find((scene: any) => scene.uuid === uuid || scene.path === fullPath);

                resolve({
                    success: true,
                    message: `Scene '${sceneName}' created successfully`,
                    data: {
                        uuid,
                        url: fullPath,
                        name: sceneName,
                        sceneVerified: !!createdScene
                    },
                    verificationData: createdScene
                });
            } catch (err: any) {
                resolve({
                    success: false,
                    error: `Failed to create scene '${sceneName}' with Cocos Creator editor APIs: ${err.message}`,
                    instruction: 'Create the scene manually from Cocos Creator if your editor version does not expose new-scene/save-scene-as messages, then use scene_management.open to open it.'
                });
            }
        });
    }

    private normalizeScenePath(sceneName: string, savePath: string): string {
        const normalizedBase = savePath.replace(/\\/g, '/').replace(/\/$/, '');
        if (normalizedBase.endsWith('.scene')) {
            return normalizedBase.startsWith('db://') ? normalizedBase : `db://assets/${normalizedBase}`;
        }
        const fileName = sceneName.endsWith('.scene') ? sceneName : `${sceneName}.scene`;
        const joinedPath = `${normalizedBase}/${fileName}`;
        return joinedPath.startsWith('db://') ? joinedPath : `db://assets/${joinedPath}`;
    }

    private async createEditorScene(): Promise<void> {
        const attempts = [
            () => Editor.Message.request('scene', 'new-scene'),
            () => Editor.Message.request('scene', 'create-scene'),
            () => Editor.Message.request('scene', 'create-new-scene')
        ];

        let lastError: any = null;
        for (const attempt of attempts) {
            try {
                await attempt();
                await new Promise(resolve => setTimeout(resolve, 200));
                return;
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError || new Error('No supported new-scene editor message was available');
    }

    private async saveSceneToPath(scenePath: string): Promise<void> {
        const attempts = [
            () => (Editor.Message.request as any)('scene', 'save-scene-as', scenePath),
            () => (Editor.Message.request as any)('scene', 'save-scene-as', { path: scenePath }),
            () => (Editor.Message.request as any)('scene', 'save-scene', scenePath)
        ];

        let lastError: any = null;
        for (const attempt of attempts) {
            try {
                await attempt();
                return;
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError || new Error('No supported save-scene-as editor message was available');
    }

    private async ensureDefaultSceneNodes(): Promise<void> {
        try {
            const treeResult: any = await Editor.Message.request('scene', 'query-node-tree');
            const tree = Array.isArray(treeResult) ? treeResult[0] : treeResult;
            const rootUuid = tree?.uuid;
            if (!rootUuid) {
                return;
            }

            const children = Array.isArray(tree.children) ? tree.children : [];
            const hasCamera = children.some((node: any) => /camera/i.test(node.name || '') || this.nodeHasComponent(node, 'cc.Camera'));
            const hasCanvas = children.some((node: any) => /canvas/i.test(node.name || '') || this.nodeHasComponent(node, 'cc.Canvas'));

            if (!hasCamera) {
                await this.createDefaultNode('Main Camera', rootUuid, ['cc.Camera']);
            }
            if (!hasCanvas) {
                await this.createDefaultNode('Canvas', rootUuid, ['cc.Canvas', 'cc.UITransform']);
            }
        } catch (err) {
            console.warn('[SceneTools] Failed to ensure default scene nodes:', err);
        }
    }

    private nodeHasComponent(node: any, componentType: string): boolean {
        const components = node?.__comps__ || node?.components || [];
        return components.some((component: any) => {
            const type = component.__type__ || component.type || component.cid || '';
            return type === componentType || String(type).includes(componentType);
        });
    }

    private async createDefaultNode(name: string, parentUuid: string, components: string[]): Promise<void> {
        try {
            await (Editor.Message.request as any)('scene', 'create-node', {
                name,
                parent: parentUuid,
                components
            });
        } catch (err) {
            console.warn(`[SceneTools] Failed to create default node '${name}':`, err);
        }
    }

    private async getSceneHierarchy(includeComponents: boolean = false): Promise<ToolResponse> {
        return new Promise((resolve) => {
            // 优先尝试使用 Editor API 查询场景节点树
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                if (tree) {
                    const hierarchy = this.buildHierarchy(tree, includeComponents);
                    resolve({
                        success: true,
                        data: hierarchy
                    });
                } else {
                    resolve({ success: false, error: 'No scene hierarchy available' });
                }
            }).catch((err: Error) => {
                // 备用方案：使用场景脚本
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getSceneHierarchy',
                    args: [includeComponents]
                };

                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    resolve(result);
                }).catch((err2: Error) => {
                    resolve({ success: false, error: `Direct API failed: ${err.message}, Scene script failed: ${err2.message}` });
                });
            });
        });
    }

    private buildHierarchy(node: any, includeComponents: boolean): any {
        const nodeInfo: any = {
            uuid: node.uuid,
            name: node.name,
            type: node.type,
            active: node.active,
            children: []
        };

        if (includeComponents && node.__comps__) {
            nodeInfo.components = node.__comps__.map((comp: any) => ({
                type: comp.__type__ || 'Unknown',
                enabled: comp.enabled !== undefined ? comp.enabled : true
            }));
        }

        if (node.children) {
            nodeInfo.children = node.children.map((child: any) =>
                this.buildHierarchy(child, includeComponents)
            );
        }

        return nodeInfo;
    }

    private async saveSceneAs(path: string): Promise<ToolResponse> {
        return new Promise(async (resolve) => {
            const sceneName = path.split(/[\\/]/).pop()?.replace(/\.scene$/i, '') || 'NewScene';
            const scenePath = this.normalizeScenePath(sceneName, path);

            try {
                await this.saveSceneToPath(scenePath);
                const uuid = await Editor.Message.request('asset-db', 'query-uuid', scenePath);
                resolve({
                    success: true,
                    message: `Scene saved as ${scenePath}`,
                    data: { uuid, path: scenePath }
                });
            } catch (err: any) {
                resolve({
                    success: false,
                    error: `Failed to save scene as '${scenePath}': ${err.message}`
                });
            }
        });
    }

    private async closeScene(): Promise<ToolResponse> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'close-scene').then(() => {
                resolve({
                    success: true,
                    message: 'Scene closed successfully'
                });
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }
}
