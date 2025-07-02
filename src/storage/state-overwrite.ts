// <letsboot fork>
// letsboot fork additional file for state overwrite
import * as vscode from "vscode"
import { GlobalStateKey, LocalStateKey, SecretKey } from "../core/storage/state-keys"
import { updateGlobalState, updateWorkspaceState, storeSecret } from "../core/storage/state"

// Track which properties were originally set in the user's settings.json
const originalOverrideKeys = new Set<string>()
const originalSecretOverrideKeys = new Set<string>()

// Track mapping from actual storage keys to their original nested paths
const keyToNestedPathMap = new Map<string, string>()

// Track if we're currently applying overrides to prevent circular updates
let isApplyingOverrides = false

/**
 * Deep merge two objects, with source properties overriding target properties
 */
export function deepMerge(target: any, source: any): any {
	if (source === null || source === undefined) {
		return target
	}

	if (typeof source !== "object" || Array.isArray(source)) {
		return source
	}

	if (typeof target !== "object" || Array.isArray(target) || target === null) {
		target = {}
	}

	const result = { ...target }

	for (const key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key])) {
				result[key] = deepMerge(result[key], source[key])
			} else {
				result[key] = source[key]
			}
		}
	}

	return result
}

/**
 * Flattens nested object paths for tracking (e.g., "apiConfiguration.openRouterApiKey")
 */
function flattenObjectPaths(obj: any, prefix = "", paths = new Set<string>()): Set<string> {
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			const fullPath = prefix ? `${prefix}.${key}` : key
			paths.add(fullPath)

			if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
				flattenObjectPaths(obj[key], fullPath, paths)
			}
		}
	}
	return paths
}

/**
 * Gets a nested property value using dot notation path
 */
function getNestedValue(obj: any, path: string): any {
	return path.split(".").reduce((current, key) => current?.[key], obj)
}

/**
 * Sets a nested property value using dot notation path
 */
function setNestedValue(obj: any, path: string, value: any): void {
	const keys = path.split(".")
	const lastKey = keys.pop()!
	const target = keys.reduce((current, key) => {
		if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
			current[key] = {}
		}
		return current[key]
	}, obj)
	target[lastKey] = value
}

/**
 * Determines if a key belongs to workspace storage (LocalStateKey)
 */
function isLocalStateKey(key: string): key is LocalStateKey {
	const localStateKeys: LocalStateKey[] = [
		"localClineRulesToggles",
		"chatSettings",
		"apiProvider",
		"apiModelId",
		"thinkingBudgetTokens",
		"reasoningEffort",
		"vsCodeLmModelSelector",
		"awsBedrockCustomSelected",
		"awsBedrockCustomModelBaseId",
		"openRouterModelId",
		"openRouterModelInfo",
		"openAiModelId",
		"openAiModelInfo",
		"ollamaModelId",
		"lmStudioModelId",
		"liteLlmModelId",
		"liteLlmModelInfo",
		"requestyModelId",
		"requestyModelInfo",
		"togetherModelId",
		"fireworksModelId",
		"previousModeApiProvider",
		"previousModeModelId",
		"previousModeModelInfo",
		"previousModeVsCodeLmModelSelector",
		"previousModeThinkingBudgetTokens",
		"previousModeReasoningEffort",
		"previousModeAwsBedrockCustomSelected",
		"previousModeAwsBedrockCustomModelBaseId",
		"previousModeSapAiCoreClientId",
		"previousModeSapAiCoreClientSecret",
		"previousModeSapAiCoreBaseUrl",
		"previousModeSapAiCoreTokenUrl",
		"previousModeSapAiCoreResourceGroup",
		"previousModeSapAiCoreModelId",
	]
	return localStateKeys.includes(key as LocalStateKey)
}

/**
 * Determines if a key belongs to secrets storage
 */
function isSecretKey(key: string): key is SecretKey {
	const secretKeys: SecretKey[] = [
		"apiKey",
		"clineApiKey",
		"openRouterApiKey",
		"awsAccessKey",
		"awsSecretKey",
		"awsSessionToken",
		"openAiApiKey",
		"geminiApiKey",
		"openAiNativeApiKey",
		"deepSeekApiKey",
		"requestyApiKey",
		"togetherApiKey",
		"fireworksApiKey",
		"qwenApiKey",
		"doubaoApiKey",
		"mistralApiKey",
		"liteLlmApiKey",
		"authNonce",
		"asksageApiKey",
		"xaiApiKey",
		"nebiusApiKey",
		"sambanovaApiKey",
		"cerebrasApiKey",
		"sapAiCoreClientId",
		"sapAiCoreClientSecret",
	]
	return secretKeys.includes(key as SecretKey)
}

/**
 * Applies state overrides from VSCode settings to the current extension state
 * This should be called early in the state loading process
 */
export async function applyStateOverrides(context: vscode.ExtensionContext, currentState: any): Promise<any> {
	if (isApplyingOverrides) {
		return currentState
	}

	const config = vscode.workspace.getConfiguration("cline")
	const overwriteState = config.get<Record<string, any>>("overwriteState")

	if (!overwriteState || typeof overwriteState !== "object") {
		return currentState
	}

	console.log("[Letsboot Fork] Applying state overwrites from settings.json...")
	isApplyingOverrides = true

	try {
		// Track all override paths for later detection
		const overridePaths = flattenObjectPaths(overwriteState)
		originalOverrideKeys.clear()
		overridePaths.forEach((path) => originalOverrideKeys.add(path))

		// Apply deep merge to preserve existing nested properties
		const mergedState = deepMerge(currentState, overwriteState)

		console.log(`[Letsboot Fork] Applied ${originalOverrideKeys.size} state overrides`)
		return mergedState
	} catch (error) {
		console.error("[Letsboot Fork] Error applying state overrides:", error)
		return currentState
	} finally {
		isApplyingOverrides = false
	}
}

/**
 * Updates a property in the user's settings.json if it was originally overridden
 * This should be called whenever the extension updates state through the UI
 */
export async function updateOverriddenProperty(
	context: vscode.ExtensionContext,
	key: string,
	value: any,
	parentPath?: string,
): Promise<void> {
	if (isApplyingOverrides) {
		return
	}

	const fullPath = parentPath ? `${parentPath}.${key}` : key

	// Check if this key was originally overridden directly
	let targetPath = fullPath
	let wasOverridden = originalOverrideKeys.has(fullPath)

	// If not found directly, check if this key was overridden as part of apiConfiguration
	if (!wasOverridden && !parentPath) {
		const apiConfigPath = `apiConfiguration.${key}`
		if (originalOverrideKeys.has(apiConfigPath)) {
			targetPath = apiConfigPath
			wasOverridden = true
		}
	}

	// Only update settings.json if this property was originally overridden
	if (!wasOverridden) {
		console.log(
			`[Letsboot Fork] Key ${fullPath} (also checked ${!parentPath ? `apiConfiguration.${key}` : "N/A"}) not in original overrides, skipping settings.json update`,
		)
		return
	}

	try {
		const config = vscode.workspace.getConfiguration("cline")
		const currentOverwriteState = config.get<Record<string, any>>("overwriteState") || {}

		// Update the nested property in the override state
		const updatedOverwriteState = { ...currentOverwriteState }
		setNestedValue(updatedOverwriteState, targetPath, value)

		// Update settings.json
		await config.update("overwriteState", updatedOverwriteState, vscode.ConfigurationTarget.Global)
		console.log(`[Letsboot Fork] Updated overwriteState.${targetPath} in settings.json`)
	} catch (error) {
		console.error(`[Letsboot Fork] Failed to update overwriteState.${targetPath} in settings.json:`, error)
	}
}

/**
 * Wrapper for updateGlobalState that also updates settings.json if needed
 */
export async function updateGlobalStateWithOverride(
	context: vscode.ExtensionContext,
	key: GlobalStateKey,
	value: any,
): Promise<void> {
	// Always update internal state first
	await updateGlobalState(context, key, value)

	// Update settings.json if this was originally overridden
	await updateOverriddenProperty(context, key, value)
}

/**
 * Wrapper for updateWorkspaceState that also updates settings.json if needed
 */
export async function updateWorkspaceStateWithOverride(
	context: vscode.ExtensionContext,
	key: LocalStateKey,
	value: any,
): Promise<void> {
	// Always update internal state first
	await updateWorkspaceState(context, key, value)

	// Update settings.json if this was originally overridden
	await updateOverriddenProperty(context, key, value)
}

/**
 * Wrapper for storeSecret that also updates settings.json if needed
 */
export async function storeSecretWithOverride(context: vscode.ExtensionContext, key: SecretKey, value?: string): Promise<void> {
	// Always update internal secrets first
	await storeSecret(context, key, value)

	// Update settings.json if this was originally overridden
	await updateOverriddenProperty(context, key, value)
}

/**
 * Special handler for complex nested objects like apiConfiguration
 * This handles updates to nested properties within complex state objects
 */
export async function updateNestedStateWithOverride(
	context: vscode.ExtensionContext,
	parentKey: string,
	nestedKey: string,
	value: any,
): Promise<void> {
	// Determine storage type based on the nested key
	if (isSecretKey(nestedKey)) {
		await storeSecret(context, nestedKey, value)
	} else if (isLocalStateKey(nestedKey)) {
		await updateWorkspaceState(context, nestedKey, value)
	} else {
		// Assume global state for other keys
		await updateGlobalState(context, nestedKey as GlobalStateKey, value)
	}

	// Update settings.json if this nested property was originally overridden
	await updateOverriddenProperty(context, nestedKey, value, parentKey)
}

/**
 * Applies state overrides from VSCode settings at extension startup
 * This should be called once during extension activation
 */
export async function applyStateOverridesOnStartup(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration("cline")
	const overwriteState = config.get<Record<string, any>>("overwriteState")

	if (!overwriteState || typeof overwriteState !== "object") {
		return
	}

	console.log("[Letsboot Fork] Applying initial state overwrites from settings.json...")
	isApplyingOverrides = true

	try {
		// Track all override paths for later detection
		const overridePaths = flattenObjectPaths(overwriteState)
		originalOverrideKeys.clear()
		overridePaths.forEach((path) => originalOverrideKeys.add(path))

		// Handle nested objects and apply overrides
		for (const [key, value] of Object.entries(overwriteState)) {
			try {
				if (typeof value === "object" && value !== null && !Array.isArray(value)) {
					// For nested objects, we need to handle each property separately
					for (const [nestedKey, nestedValue] of Object.entries(value)) {
						const fullPath = `${key}.${nestedKey}`
						if (isSecretKey(nestedKey)) {
							await context.secrets.store(nestedKey, String(nestedValue))
						} else if (isLocalStateKey(nestedKey)) {
							await context.workspaceState.update(nestedKey, nestedValue)
						} else {
							// For nested properties in global state, merge with existing
							const existingValue = await context.globalState.get(key)
							const mergedValue = deepMerge(existingValue || {}, { [nestedKey]: nestedValue })
							await context.globalState.update(key, mergedValue)
						}
						console.log(`[Letsboot Fork] Applied nested override for ${fullPath}`)
					}
				} else {
					// Handle top-level properties
					if (isSecretKey(key)) {
						await context.secrets.store(key, String(value))
					} else if (isLocalStateKey(key)) {
						await context.workspaceState.update(key, value)
					} else {
						await context.globalState.update(key, value)
					}
					console.log(`[Letsboot Fork] Applied override for ${key}`)
				}
			} catch (error) {
				console.error(`[Letsboot Fork] Error applying override for ${key}:`, error)
			}
		}

		console.log(`[Letsboot Fork] Applied ${originalOverrideKeys.size} state overrides`)
	} catch (error) {
		console.error("[Letsboot Fork] Error applying state overrides:", error)
	} finally {
		isApplyingOverrides = false
	}
}

/**
 * Clears the applied overrides cache (useful for testing or configuration changes)
 */
export function clearOverridesCache(): void {
	originalOverrideKeys.clear()
	originalSecretOverrideKeys.clear()
	console.log("[Letsboot Fork] Cleared overrides cache")
}
// </letsboot fork>
