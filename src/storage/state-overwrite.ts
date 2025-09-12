// biome-ignore-all plugin: This file intentionally uses direct VSCode API for state overrides
import * as vscode from "vscode"

/**
 * Tracks which properties were originally overridden to prevent infinite loops
 */
const overriddenProperties = new Set<string>()

/**
 * Track all nested paths within an object hierarchy
 */
function trackAllNestedPaths(obj: any, basePath: string, storageType: string = ""): void {
	const fullBasePath = storageType ? `${storageType}.${basePath}` : basePath

	// Track the base path itself
	overriddenProperties.add(fullBasePath)

	// If it's an object, track all nested paths recursively
	if (obj && typeof obj === "object" && !Array.isArray(obj)) {
		for (const key in obj) {
			if (Object.hasOwn(obj, key)) {
				const nestedPath = `${basePath}.${key}`
				const fullNestedPath = storageType ? `${storageType}.${nestedPath}` : nestedPath
				overriddenProperties.add(fullNestedPath)

				// Recursively track deeper nested objects
				if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
					trackAllNestedPaths(obj[key], nestedPath, storageType)
				}
			}
		}
	}
}

/**
 * Deep merge utility that preserves existing nested properties while applying overrides
 */
function deepMerge(target: any, source: any, path = ""): any {
	if (source === null || source === undefined) {
		return target
	}

	if (typeof source !== "object" || Array.isArray(source)) {
		// Track this property as overridden
		if (path) {
			overriddenProperties.add(path)
		}
		return source
	}

	if (typeof target !== "object" || target === null || Array.isArray(target)) {
		target = {}
	}

	// Track this object path and all its parent paths
	if (path) {
		overriddenProperties.add(path)
		// Track all parent paths
		const parts = path.split(".")
		for (let i = 1; i < parts.length; i++) {
			overriddenProperties.add(parts.slice(0, i).join("."))
		}
	}

	for (const key in source) {
		if (Object.hasOwn(source, key)) {
			const currentPath = path ? `${path}.${key}` : key
			target[key] = deepMerge(target[key], source[key], currentPath)
		}
	}

	return target
}

/**
 * Apply state overrides from user settings.json during extension startup
 */
export async function applyStateOverridesOnStartup(context: vscode.ExtensionContext): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration("cline")
		const overwriteState = config.get<any>("overwriteState")

		if (!overwriteState || typeof overwriteState !== "object") {
			return
		}

		console.log("[Letsboot Fork] Applying state overrides from settings.json:", overwriteState)

		// Clear previous overridden properties tracking
		overriddenProperties.clear()

		// Apply overrides to global state
		if (overwriteState.globalState) {
			// Track all nested paths in the override configuration
			for (const key in overwriteState.globalState) {
				trackAllNestedPaths(overwriteState.globalState[key], key, "globalState")
			}

			const currentGlobalState = context.globalState.keys().reduce((acc, key) => {
				// biome-ignore lint/suspicious/noExplicitAny: VSCode API returns any
				acc[key] = context.globalState.get(key)
				return acc
			}, {} as any)

			const mergedGlobalState = deepMerge(currentGlobalState, overwriteState.globalState, "globalState")

			// Update global state with merged values
			for (const key in mergedGlobalState) {
				await context.globalState.update(key, mergedGlobalState[key])
			}
		}

		// Apply overrides to workspace state
		if (overwriteState.workspaceState) {
			// Track all nested paths in the override configuration
			for (const key in overwriteState.workspaceState) {
				trackAllNestedPaths(overwriteState.workspaceState[key], key, "workspaceState")
			}

			const currentWorkspaceState = context.workspaceState.keys().reduce((acc, key) => {
				// biome-ignore lint/suspicious/noExplicitAny: VSCode API returns any
				acc[key] = context.workspaceState.get(key)
				return acc
			}, {} as any)

			const mergedWorkspaceState = deepMerge(currentWorkspaceState, overwriteState.workspaceState, "workspaceState")

			// Update workspace state with merged values
			for (const key in mergedWorkspaceState) {
				await context.workspaceState.update(key, mergedWorkspaceState[key])
			}
		}

		// Apply overrides to secrets
		if (overwriteState.secrets) {
			for (const key in overwriteState.secrets) {
				await context.secrets.store(key, overwriteState.secrets[key])
				overriddenProperties.add(`secrets.${key}`)
			}
		}

		console.log("[Letsboot Fork] State overrides applied successfully")
	} catch (error) {
		console.error("[Letsboot Fork] Error applying state overrides:", error)
	}
}

/**
 * Update global state and sync back to settings.json if the property was originally overridden
 */
export async function updateGlobalStateWithOverride(context: vscode.ExtensionContext, key: string, value: any): Promise<void> {
	// Always update the actual state
	await context.globalState.update(key, value)

	// Check if this property or any of its nested properties were originally overridden
	const fullKey = `globalState.${key}`
	let shouldUpdate = false

	// Check if the exact key was overridden
	if (overriddenProperties.has(fullKey) || overriddenProperties.has(key)) {
		shouldUpdate = true
	} else {
		// Check if any nested property within this key was overridden
		// For example, if "globalState.autoApprovalSettings.maxRequests" was overridden,
		// and we're updating "autoApprovalSettings", we should sync the entire object
		for (const overriddenPath of overriddenProperties) {
			if (overriddenPath.startsWith(`${fullKey}.`)) {
				shouldUpdate = true
				break
			}
		}
	}

	if (shouldUpdate) {
		await updateOverriddenProperty(fullKey, value)
	}
}

/**
 * Update workspace state and sync back to settings.json if the property was originally overridden
 */
export async function updateWorkspaceStateWithOverride(context: vscode.ExtensionContext, key: string, value: any): Promise<void> {
	// Always update the actual state
	await context.workspaceState.update(key, value)

	// Check if this property or any of its nested properties were originally overridden
	const fullKey = `workspaceState.${key}`
	let shouldUpdate = false

	// Check if the exact key was overridden
	if (overriddenProperties.has(fullKey) || overriddenProperties.has(key)) {
		shouldUpdate = true
	} else {
		// Check if any nested property within this key was overridden
		for (const overriddenPath of overriddenProperties) {
			if (overriddenPath.startsWith(`${fullKey}.`)) {
				shouldUpdate = true
				break
			}
		}
	}

	if (shouldUpdate) {
		await updateOverriddenProperty(fullKey, value)
	}
}

/**
 * Store secret and sync back to settings.json if the property was originally overridden
 */
export async function storeSecretWithOverride(context: vscode.ExtensionContext, key: string, value: string): Promise<void> {
	// Always update the actual secret
	await context.secrets.store(key, value)

	// If this property was originally overridden, update settings.json
	if (overriddenProperties.has(`secrets.${key}`)) {
		await updateOverriddenProperty(`secrets.${key}`, value)
	}
}

/**
 * Update a specific property in the settings.json overwriteState
 */
export async function updateOverriddenProperty(propertyPath: string, value: any): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration("cline")
		const currentOverwriteState = config.get<any>("overwriteState") || {}

		// Parse the property path and update the nested object
		const pathParts = propertyPath.split(".")
		let current = currentOverwriteState

		// Navigate to the parent object
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!current[part] || typeof current[part] !== "object") {
				current[part] = {}
			}
			current = current[part]
		}

		// Set the final value
		const finalKey = pathParts[pathParts.length - 1]
		current[finalKey] = value

		// Update the configuration
		await config.update("overwriteState", currentOverwriteState, vscode.ConfigurationTarget.Global)

		console.log(`[Letsboot Fork] Updated overridden property ${propertyPath} in settings.json`)
	} catch (error) {
		console.error(`[Letsboot Fork] Error updating overridden property ${propertyPath}:`, error)
	}
}

/**
 * Check if a property path is currently overridden
 */
export function isPropertyOverridden(propertyPath: string): boolean {
	return overriddenProperties.has(propertyPath)
}

/**
 * Get all currently overridden property paths
 */
export function getOverriddenProperties(): string[] {
	return Array.from(overriddenProperties)
}
