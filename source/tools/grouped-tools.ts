import { ToolDefinition, ToolExecutor, ToolResponse } from '../types';

interface ActionRoute {
    action: string;
    category: string;
    tool: string;
    description?: string;
}

interface GroupedToolSpec {
    name: string;
    description: string;
    routes: ActionRoute[];
}

export class GroupedTools implements ToolExecutor {
    private readonly specs: GroupedToolSpec[];

    constructor(private readonly tools: Record<string, ToolExecutor>) {
        this.specs = this.createSpecs();
    }

    public hasTool(toolName: string): boolean {
        return this.specs.some(spec => spec.name === toolName);
    }

    public getTools(): ToolDefinition[] {
        return this.specs.map(spec => ({
            name: spec.name,
            description: this.buildDescription(spec),
            inputSchema: this.buildInputSchema(spec)
        }));
    }

    public async execute(toolName: string, args: any = {}): Promise<ToolResponse> {
        const spec = this.specs.find(item => item.name === toolName);
        if (!spec) {
            throw new Error(`Unknown grouped tool: ${toolName}`);
        }

        const action = typeof args.action === 'string' ? args.action : '';
        const route = spec.routes.find(item => item.action === action || item.tool === action);
        if (!route) {
            return {
                success: false,
                error: `Unknown action '${action}' for ${toolName}`,
                instruction: `Use one of: ${spec.routes.map(item => item.action).join(', ')}`
            };
        }

        const toolSet = this.tools[route.category];
        if (!toolSet) {
            return {
                success: false,
                error: `Tool category '${route.category}' is not available`
            };
        }

        const payload = {
            ...args,
            ...(args.arguments && typeof args.arguments === 'object' ? args.arguments : {}),
            ...(args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? args.args : {})
        };
        delete payload.action;
        delete payload.arguments;
        delete payload.args;

        return await toolSet.execute(route.tool, payload);
    }

    private buildDescription(spec: GroupedToolSpec): string {
        const actions = spec.routes.map(route => {
            const suffix = route.description ? ` - ${route.description}` : '';
            return `${route.action}${suffix}`;
        });
        return `${spec.description}\nAvailable actions: ${actions.join('; ')}`;
    }

    private buildInputSchema(spec: GroupedToolSpec): any {
        const properties: Record<string, any> = {
            action: {
                type: 'string',
                enum: spec.routes.map(route => route.action),
                description: 'Operation to run inside this grouped MCP tool.'
            },
            args: {
                type: 'object',
                description: 'Optional nested argument object. You may also pass action parameters as top-level fields.',
                additionalProperties: true
            },
            arguments: {
                type: 'object',
                description: 'Optional MCP-style nested argument object. Top-level fields take the same shape.',
                additionalProperties: true
            }
        };

        for (const route of spec.routes) {
            const toolDefinition = this.findUnderlyingTool(route);
            const schemaProperties = toolDefinition?.inputSchema?.properties || {};
            for (const [key, value] of Object.entries(schemaProperties)) {
                if (key === 'action' || key === 'args' || key === 'arguments') {
                    continue;
                }
                if (!Object.prototype.hasOwnProperty.call(properties, key)) {
                    properties[key] = value;
                }
            }
        }

        return {
            type: 'object',
            properties,
            required: ['action'],
            additionalProperties: true
        };
    }

    private findUnderlyingTool(route: ActionRoute): ToolDefinition | undefined {
        const toolSet = this.tools[route.category];
        if (!toolSet) {
            return undefined;
        }
        return toolSet.getTools().find(tool => tool.name === route.tool);
    }

    private route(category: string, tool: string, action = tool, description?: string): ActionRoute {
        return { category, tool, action, description };
    }

    private createSpecs(): GroupedToolSpec[] {
        const r = this.route.bind(this);
        return [
            {
                name: 'scene_management',
                description: 'Open, save, create, close, and inspect Cocos Creator scenes.',
                routes: [
                    r('scene', 'get_current_scene', 'get_current'),
                    r('scene', 'get_scene_list', 'list'),
                    r('scene', 'open_scene', 'open'),
                    r('scene', 'save_scene', 'save'),
                    r('scene', 'create_scene', 'create'),
                    r('scene', 'save_scene_as', 'save_as'),
                    r('scene', 'close_scene', 'close')
                ]
            },
            {
                name: 'scene_hierarchy',
                description: 'Read the active scene hierarchy.',
                routes: [
                    r('scene', 'get_scene_hierarchy', 'get')
                ]
            },
            {
                name: 'node_lifecycle',
                description: 'Create, delete, duplicate, and move nodes.',
                routes: [
                    r('node', 'create_node', 'create'),
                    r('node', 'delete_node', 'delete'),
                    r('node', 'duplicate_node', 'duplicate'),
                    r('node', 'move_node', 'move')
                ]
            },
            {
                name: 'node_query',
                description: 'Find and inspect nodes.',
                routes: [
                    r('node', 'get_node_info', 'get_info'),
                    r('node', 'find_nodes', 'find'),
                    r('node', 'find_node_by_name', 'find_by_name'),
                    r('node', 'get_all_nodes', 'list'),
                    r('node', 'detect_node_type', 'detect_type')
                ]
            },
            {
                name: 'node_transform',
                description: 'Change node properties and transforms.',
                routes: [
                    r('node', 'set_node_property', 'set_property'),
                    r('node', 'set_node_transform', 'set_transform')
                ]
            },
            {
                name: 'component_manage',
                description: 'Add, remove, and list available component types.',
                routes: [
                    r('component', 'add_component', 'add'),
                    r('component', 'remove_component', 'remove'),
                    r('component', 'get_available_components', 'list_available')
                ]
            },
            {
                name: 'component_query',
                description: 'Inspect node components.',
                routes: [
                    r('component', 'get_components', 'list'),
                    r('component', 'get_component_info', 'get_info')
                ]
            },
            {
                name: 'component_property',
                description: 'Set component properties.',
                routes: [
                    r('component', 'set_component_property', 'set')
                ]
            },
            {
                name: 'component_script',
                description: 'Attach custom script components.',
                routes: [
                    r('component', 'attach_script', 'attach')
                ]
            },
            {
                name: 'prefab_browse',
                description: 'Browse and validate prefab assets.',
                routes: [
                    r('prefab', 'get_prefab_list', 'list'),
                    r('prefab', 'load_prefab', 'load'),
                    r('prefab', 'get_prefab_info', 'get_info'),
                    r('prefab', 'validate_prefab', 'validate')
                ]
            },
            {
                name: 'prefab_lifecycle',
                description: 'Create, update, and duplicate prefabs.',
                routes: [
                    r('prefab', 'create_prefab', 'create'),
                    r('prefab', 'update_prefab', 'update'),
                    r('prefab', 'duplicate_prefab', 'duplicate')
                ]
            },
            {
                name: 'prefab_instance',
                description: 'Instantiate and restore prefab instances.',
                routes: [
                    r('prefab', 'instantiate_prefab', 'instantiate'),
                    r('prefab', 'revert_prefab', 'revert'),
                    r('prefab', 'restore_prefab_node', 'restore_node')
                ]
            },
            {
                name: 'project_manage',
                description: 'Run, build, refresh, and inspect project settings.',
                routes: [
                    r('project', 'run_project', 'run'),
                    r('project', 'build_project', 'build'),
                    r('project', 'get_project_info', 'get_info'),
                    r('project', 'get_project_settings', 'get_settings'),
                    r('project', 'refresh_assets', 'refresh_assets')
                ]
            },
            {
                name: 'project_asset',
                description: 'Query and edit project assets.',
                routes: [
                    r('project', 'import_asset', 'import'),
                    r('project', 'get_asset_info', 'get_info'),
                    r('project', 'get_assets', 'list'),
                    r('project', 'create_asset', 'create'),
                    r('project', 'copy_asset', 'copy'),
                    r('project', 'move_asset', 'move'),
                    r('project', 'delete_asset', 'delete'),
                    r('project', 'save_asset', 'save'),
                    r('project', 'reimport_asset', 'reimport'),
                    r('project', 'query_asset_path', 'query_path'),
                    r('project', 'query_asset_uuid', 'query_uuid'),
                    r('project', 'query_asset_url', 'query_url'),
                    r('project', 'find_asset_by_name', 'find_by_name'),
                    r('project', 'get_asset_details', 'get_details')
                ]
            },
            {
                name: 'project_build',
                description: 'Operate build and preview server tools.',
                routes: [
                    r('project', 'get_build_settings', 'get_settings'),
                    r('project', 'open_build_panel', 'open_panel'),
                    r('project', 'check_builder_status', 'check_status'),
                    r('project', 'start_preview_server', 'start_preview'),
                    r('project', 'stop_preview_server', 'stop_preview')
                ]
            },
            {
                name: 'debug_console',
                description: 'Read console state and execute debug scripts.',
                routes: [
                    r('debug', 'get_console_logs', 'get_logs'),
                    r('debug', 'clear_console', 'clear'),
                    r('debug', 'execute_script', 'execute_script'),
                    r('debug', 'get_node_tree', 'get_node_tree'),
                    r('debug', 'get_performance_stats', 'get_performance'),
                    r('debug', 'validate_scene', 'validate_scene'),
                    r('debug', 'get_editor_info', 'get_editor_info')
                ]
            },
            {
                name: 'debug_logs',
                description: 'Read and search project log files.',
                routes: [
                    r('debug', 'get_project_logs', 'get_project_logs'),
                    r('debug', 'get_log_file_info', 'get_log_file_info'),
                    r('debug', 'search_project_logs', 'search')
                ]
            },
            {
                name: 'preferences_manage',
                description: 'Open, query, set, reset, export, and import preferences.',
                routes: [
                    r('preferences', 'open_preferences_settings', 'open'),
                    r('preferences', 'query_preferences_config', 'query'),
                    r('preferences', 'set_preferences_config', 'set'),
                    r('preferences', 'get_all_preferences', 'list'),
                    r('preferences', 'reset_preferences', 'reset'),
                    r('preferences', 'export_preferences', 'export'),
                    r('preferences', 'import_preferences', 'import')
                ]
            },
            {
                name: 'server_info',
                description: 'Inspect MCP server and network information.',
                routes: [
                    r('server', 'query_server_ip_list', 'ip_list'),
                    r('server', 'query_sorted_server_ip_list', 'sorted_ip_list'),
                    r('server', 'query_server_port', 'port'),
                    r('server', 'get_server_status', 'status'),
                    r('server', 'check_server_connectivity', 'check_connectivity'),
                    r('server', 'get_network_interfaces', 'network_interfaces')
                ]
            },
            {
                name: 'broadcast_message',
                description: 'Manage Cocos editor broadcast messages.',
                routes: [
                    r('broadcast', 'get_broadcast_log', 'get_log'),
                    r('broadcast', 'listen_broadcast', 'listen'),
                    r('broadcast', 'stop_listening', 'stop_listening'),
                    r('broadcast', 'clear_broadcast_log', 'clear_log'),
                    r('broadcast', 'get_active_listeners', 'active_listeners')
                ]
            },
            {
                name: 'scene_property',
                description: 'Reset properties and edit array values in the scene.',
                routes: [
                    r('sceneAdvanced', 'reset_node_property', 'reset_node_property'),
                    r('sceneAdvanced', 'move_array_element', 'move_array_element'),
                    r('sceneAdvanced', 'remove_array_element', 'remove_array_element'),
                    r('sceneAdvanced', 'reset_node_transform', 'reset_node_transform'),
                    r('sceneAdvanced', 'reset_component', 'reset_component'),
                    r('sceneAdvanced', 'restore_prefab', 'restore_prefab')
                ]
            },
            {
                name: 'scene_clipboard',
                description: 'Copy, paste, and cut scene nodes.',
                routes: [
                    r('sceneAdvanced', 'copy_node', 'copy'),
                    r('sceneAdvanced', 'paste_node', 'paste'),
                    r('sceneAdvanced', 'cut_node', 'cut')
                ]
            },
            {
                name: 'scene_execution',
                description: 'Execute scene scripts and control undo/snapshot state.',
                routes: [
                    r('sceneAdvanced', 'execute_component_method', 'execute_component_method'),
                    r('sceneAdvanced', 'execute_scene_script', 'execute_scene_script'),
                    r('sceneAdvanced', 'scene_snapshot', 'snapshot'),
                    r('sceneAdvanced', 'scene_snapshot_abort', 'snapshot_abort'),
                    r('sceneAdvanced', 'begin_undo_recording', 'begin_undo'),
                    r('sceneAdvanced', 'end_undo_recording', 'end_undo'),
                    r('sceneAdvanced', 'cancel_undo_recording', 'cancel_undo'),
                    r('sceneAdvanced', 'soft_reload_scene', 'soft_reload'),
                    r('sceneAdvanced', 'query_scene_ready', 'query_ready'),
                    r('sceneAdvanced', 'query_scene_dirty', 'query_dirty'),
                    r('sceneAdvanced', 'query_scene_classes', 'query_classes'),
                    r('sceneAdvanced', 'query_scene_components', 'query_components'),
                    r('sceneAdvanced', 'query_component_has_script', 'query_component_has_script'),
                    r('sceneAdvanced', 'query_nodes_by_asset_uuid', 'query_nodes_by_asset_uuid')
                ]
            },
            {
                name: 'scene_view_control',
                description: 'Control scene view gizmos, camera, grid, and view mode.',
                routes: [
                    r('sceneView', 'change_gizmo_tool', 'change_gizmo_tool'),
                    r('sceneView', 'query_gizmo_tool_name', 'query_gizmo_tool'),
                    r('sceneView', 'change_gizmo_pivot', 'change_gizmo_pivot'),
                    r('sceneView', 'query_gizmo_pivot', 'query_gizmo_pivot'),
                    r('sceneView', 'query_gizmo_view_mode', 'query_gizmo_view_mode'),
                    r('sceneView', 'change_gizmo_coordinate', 'change_gizmo_coordinate'),
                    r('sceneView', 'query_gizmo_coordinate', 'query_gizmo_coordinate'),
                    r('sceneView', 'change_view_mode_2d_3d', 'change_view_mode'),
                    r('sceneView', 'query_view_mode_2d_3d', 'query_view_mode'),
                    r('sceneView', 'set_grid_visible', 'set_grid_visible'),
                    r('sceneView', 'query_grid_visible', 'query_grid_visible'),
                    r('sceneView', 'set_icon_gizmo_3d', 'set_icon_gizmo_3d'),
                    r('sceneView', 'query_icon_gizmo_3d', 'query_icon_gizmo_3d'),
                    r('sceneView', 'set_icon_gizmo_size', 'set_icon_gizmo_size'),
                    r('sceneView', 'query_icon_gizmo_size', 'query_icon_gizmo_size'),
                    r('sceneView', 'focus_camera_on_nodes', 'focus_camera'),
                    r('sceneView', 'align_camera_with_view', 'align_camera_with_view'),
                    r('sceneView', 'align_view_with_node', 'align_view_with_node'),
                    r('sceneView', 'get_scene_view_status', 'status'),
                    r('sceneView', 'reset_scene_view', 'reset')
                ]
            },
            {
                name: 'reference_image_manage',
                description: 'Add, remove, switch, list, and clear scene reference images.',
                routes: [
                    r('referenceImage', 'add_reference_image', 'add'),
                    r('referenceImage', 'remove_reference_image', 'remove'),
                    r('referenceImage', 'switch_reference_image', 'switch'),
                    r('referenceImage', 'set_reference_image_data', 'set_data'),
                    r('referenceImage', 'list_reference_images', 'list'),
                    r('referenceImage', 'clear_all_reference_images', 'clear')
                ]
            },
            {
                name: 'reference_image_view',
                description: 'Query and adjust the active reference image view.',
                routes: [
                    r('referenceImage', 'query_reference_image_config', 'query_config'),
                    r('referenceImage', 'query_current_reference_image', 'query_current'),
                    r('referenceImage', 'refresh_reference_image', 'refresh'),
                    r('referenceImage', 'set_reference_image_position', 'set_position'),
                    r('referenceImage', 'set_reference_image_scale', 'set_scale'),
                    r('referenceImage', 'set_reference_image_opacity', 'set_opacity')
                ]
            },
            {
                name: 'asset_manage',
                description: 'Manage advanced assets and asset database helpers.',
                routes: [
                    r('assetAdvanced', 'save_asset_meta', 'save_meta'),
                    r('assetAdvanced', 'generate_available_url', 'generate_url'),
                    r('assetAdvanced', 'query_asset_db_ready', 'query_db_ready'),
                    r('assetAdvanced', 'open_asset_external', 'open_external'),
                    r('assetAdvanced', 'batch_import_assets', 'batch_import'),
                    r('assetAdvanced', 'batch_delete_assets', 'batch_delete')
                ]
            },
            {
                name: 'asset_analyze',
                description: 'Analyze dependencies, unused assets, and manifests.',
                routes: [
                    r('assetAdvanced', 'validate_asset_references', 'validate_references'),
                    r('assetAdvanced', 'get_asset_dependencies', 'dependencies'),
                    r('assetAdvanced', 'get_unused_assets', 'unused'),
                    r('assetAdvanced', 'compress_textures', 'compress_textures'),
                    r('assetAdvanced', 'export_asset_manifest', 'export_manifest')
                ]
            },
            {
                name: 'validation_utils',
                description: 'Validate and format MCP JSON payloads.',
                routes: [
                    r('validation', 'validate_json_params', 'validate_json'),
                    r('validation', 'safe_string_value', 'safe_string'),
                    r('validation', 'format_mcp_request', 'format_request')
                ]
            }
        ];
    }
}
