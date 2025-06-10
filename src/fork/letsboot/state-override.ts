import * as vscode from "vscode"
import { storeSecret, updateGlobalState, updateWorkspaceState, updateApiConfiguration } from "../../core/storage/state"
import { GlobalStateKey, SecretKey, LocalStateKey } from "../../core/storage/state-keys" // Import the actual types
import { ApiConfiguration } from "../../shared/api"

// --- Functions to Apply Overrides on Startup ---

// Track which overrides have been applied to prevent duplicate applications
const appliedOverrides = new Set<string>()

/**
 * Reads 'cline.overwriteState' from VS Code settings and applies it
 * to the extension's internal state storage on startup.
 */
export async function applyStateOverwriteOnStartup(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration("cline")
	const overwriteState = config.get<Record<string, any>>("overwriteState")

	if (overwriteState && typeof overwriteState === "object") {
		// Create a hash of the current overwrite state to detect changes
		const overwriteHash = JSON.stringify(overwriteState)

		// Skip if we've already applied these exact overrides
		if (appliedOverrides.has(overwriteHash)) {
			console.log("[Letsboot Fork] Overrides already applied, skipping...")
			return
		}

		console.log("[Letsboot Fork] Applying initial state overwrites from settings.json...")

		for (const key in overwriteState) {
			if (Object.prototype.hasOwnProperty.call(overwriteState, key)) {
				try {
					// Handle nested objects specially
					if (key === "apiConfiguration" && typeof overwriteState[key] === "object") {
						// Apply each property from the apiConfiguration object
						const apiConfig = overwriteState[key]
						for (const apiKey in apiConfig) {
							if (Object.prototype.hasOwnProperty.call(apiConfig, apiKey)) {
								console.log(`[Letsboot Fork] Applying apiConfiguration.${apiKey} = ${apiConfig[apiKey]}`)
								// Use direct storage APIs to avoid circular calls
								if (isLocalStateKey(apiKey as any)) {
									await context.workspaceState.update(apiKey, apiConfig[apiKey])
								} else {
									await context.globalState.update(apiKey, apiConfig[apiKey])
								}
							}
						}
					} else if (key === "autoApprovalSettings" && typeof overwriteState[key] === "object") {
						// Apply the entire autoApprovalSettings object
						console.log(`[Letsboot Fork] Applying autoApprovalSettings object`)
						await context.globalState.update(key, overwriteState[key])
					} else {
						// Apply top-level keys directly
						console.log(`[Letsboot Fork] Applying ${key} = ${overwriteState[key]}`)
						// Use direct storage APIs to avoid circular calls
						if (isLocalStateKey(key as any)) {
							await context.workspaceState.update(key, overwriteState[key])
						} else {
							await context.globalState.update(key, overwriteState[key])
						}
					}
				} catch (error) {
					console.error(`[Letsboot Fork] Error applying initial state overwrite for key "${key}":`, error)
				}
			}
		}

		// Mark these overrides as applied
		appliedOverrides.add(overwriteHash)
	}
}

// Track which secret overrides have been applied to prevent duplicate applications
const appliedSecretOverrides = new Set<string>()

/**
 * Clears the applied overrides cache to allow re-application when settings change.
 * This should be called when configuration changes are detected.
 */
export function clearAppliedOverridesCache(): void {
	appliedOverrides.clear()
	appliedSecretOverrides.clear()
	console.log("[Letsboot Fork] Cleared applied overrides cache")
}

/**
 * Reads 'cline.overwriteSecrets' from VS Code settings and applies it
 * to the extension's internal secret storage on startup.
 */
export async function applySecretOverwriteOnStartup(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration("cline")
	const overwriteSecrets = config.get<Record<string, any>>("overwriteSecrets")

	if (overwriteSecrets && typeof overwriteSecrets === "object") {
		// Create a hash of the current overwrite secrets to detect changes
		const secretsHash = JSON.stringify(overwriteSecrets)

		// Skip if we've already applied these exact secret overrides
		if (appliedSecretOverrides.has(secretsHash)) {
			console.log("[Letsboot Fork] Secret overrides already applied, skipping...")
			return
		}

		console.log("[Letsboot Fork] Applying initial secret overwrites from settings.json...")
		for (const key in overwriteSecrets) {
			// Assume keys in overwriteSecrets are valid SecretKeys based on config structure
			if (Object.prototype.hasOwnProperty.call(overwriteSecrets, key)) {
				try {
					// Use direct secrets API to avoid circular calls
					if (overwriteSecrets[key]) {
						await context.secrets.store(key, overwriteSecrets[key])
					} else {
						await context.secrets.delete(key)
					}
					console.log(`[Letsboot Fork] Applied secret override for ${key}`)
				} catch (error) {
					console.error(`[Letsboot Fork] Error applying initial secret overwrite for key "${key}":`, error)
				}
			}
		}

		// Mark these secret overrides as applied
		appliedSecretOverrides.add(secretsHash)
	}
}

// --- Helper Functions ---

/**
 * Helper function to check if a key belongs to LocalStateKey (workspace storage)
 */
function isLocalStateKey(key: string): key is LocalStateKey {
	const localStateKeys: LocalStateKey[] = [
		"localClineRulesToggles",
		"chatSettings",
		// Current active model configuration (per workspace)
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
		// Previous mode saved configurations (per workspace)
		"previousModeApiProvider",
		"previousModeModelId",
		"previousModeModelInfo",
		"previousModeVsCodeLmModelSelector",
		"previousModeThinkingBudgetTokens",
		"previousModeReasoningEffort",
		"previousModeAwsBedrockCustomSelected",
		"previousModeAwsBedrockCustomModelBaseId",
	]
	return localStateKeys.includes(key as LocalStateKey)
}

/**
 * Helper function to check if a key belongs to apiConfiguration
 */
function isApiConfigurationKey(key: string): boolean {
	const apiConfigurationKeys = [
		// Global state keys
		"awsRegion",
		"awsUseCrossRegionInference",
		"awsBedrockUsePromptCache",
		"awsBedrockEndpoint",
		"awsProfile",
		"awsUseProfile",
		"vertexProjectId",
		"vertexRegion",
		"openAiBaseUrl",
		"openAiHeaders",
		"ollamaBaseUrl",
		"ollamaApiOptionsCtxNum",
		"lmStudioBaseUrl",
		"anthropicBaseUrl",
		"geminiBaseUrl",
		"azureApiVersion",
		"openRouterProviderSorting",
		"liteLlmBaseUrl",
		"liteLlmUsePromptCache",
		"fireworksModelMaxCompletionTokens",
		"fireworksModelMaxTokens",
		"qwenApiLine",
		"asksageApiUrl",
		"favoritedModelIds",
		"requestTimeoutMs",
		// Workspace state keys
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
	]
	return apiConfigurationKeys.includes(key)
}

/**
 * Helper function to check if a key belongs to autoApprovalSettings
 */
function isAutoApprovalSettingsKey(key: string): boolean {
	// autoApprovalSettings is stored as a complete object, not individual keys
	// So this function may not be needed, but keeping for consistency
	return key === "autoApprovalSettings"
}

// --- Functions to Update settings.json from UI changes ---

/**
 * Updates a specific key within the 'cline.overwriteState' object in settings.json
 * and also updates the internal extension state.
 */
export async function updateOverwrittenState(
	context: vscode.ExtensionContext,
	key: GlobalStateKey | LocalStateKey,
	value: any,
): Promise<void> {
	const config = vscode.workspace.getConfiguration("cline")
	const currentOverwriteState = config.get<Record<string, any>>("overwriteState") || {}

	// First, always update internal state for immediate reflection in UI
	// Use direct storage APIs to avoid circular calls
	try {
		// Use the correct storage based on key type
		if (isLocalStateKey(key as any)) {
			await context.workspaceState.update(key, value)
		} else {
			await context.globalState.update(key, value)
		}
		console.log(`[Letsboot Fork] Updated internal state for ${key}.`)
	} catch (stateError) {
		console.error(`[Letsboot Fork] Failed to update internal state for ${key}:`, stateError)
		vscode.window.showErrorMessage(`[Letsboot Fork] Failed to update internal state for "${key}".`)
	}

	// Check if this key exists directly in overwriteState
	if (Object.prototype.hasOwnProperty.call(currentOverwriteState, key)) {
		try {
			// Create the updated object with only the existing keys
			const newState = { ...currentOverwriteState, [key]: value }

			// Update settings.json
			await config.update("overwriteState", newState, vscode.ConfigurationTarget.Global)
			console.log(`[Letsboot Fork] Updated overwriteState.${key} in settings.json.`)
		} catch (error) {
			console.error(`[Letsboot Fork] Failed to update overwriteState.${key} in settings.json:`, error)
			// Don't show error message to user since internal state was updated successfully
		}
		return
	}

	// Check if this key belongs to a nested object in overwriteState
	// Handle apiConfiguration nested object
	if (isApiConfigurationKey(key as any) && currentOverwriteState.apiConfiguration) {
		try {
			const newApiConfiguration = { ...currentOverwriteState.apiConfiguration, [key]: value }
			const newState = { ...currentOverwriteState, apiConfiguration: newApiConfiguration }

			// Update settings.json
			await config.update("overwriteState", newState, vscode.ConfigurationTarget.Global)
			console.log(`[Letsboot Fork] Updated overwriteState.apiConfiguration.${key} in settings.json.`)
		} catch (error) {
			console.error(`[Letsboot Fork] Failed to update overwriteState.apiConfiguration.${key} in settings.json:`, error)
		}
		return
	}

	// Handle autoApprovalSettings nested object
	if (isAutoApprovalSettingsKey(key as any) && currentOverwriteState.autoApprovalSettings) {
		try {
			const newAutoApprovalSettings = { ...currentOverwriteState.autoApprovalSettings, [key]: value }
			const newState = { ...currentOverwriteState, autoApprovalSettings: newAutoApprovalSettings }

			// Update settings.json
			await config.update("overwriteState", newState, vscode.ConfigurationTarget.Global)
			console.log(`[Letsboot Fork] Updated overwriteState.autoApprovalSettings.${key} in settings.json.`)
		} catch (error) {
			console.error(`[Letsboot Fork] Failed to update overwriteState.autoApprovalSettings.${key} in settings.json:`, error)
		}
		return
	}

	console.log(`[Letsboot Fork] Key ${key} not found in overwriteState or nested objects, skipping settings.json update.`)
}

/**
 * Updates a specific key within the 'cline.overwriteSecrets' object in settings.json
 * and also updates the internal extension state.
 */
export async function updateOverwrittenSecret(context: vscode.ExtensionContext, key: SecretKey, value: any): Promise<void> {
	const config = vscode.workspace.getConfiguration("cline")
	const currentOverwriteSecrets = config.get<Record<string, any>>("overwriteSecrets") || {}

	// First, always update internal secrets for immediate reflection in UI
	try {
		if (value) {
			await context.secrets.store(key, value)
		} else {
			await context.secrets.delete(key)
		}
		console.log(`[Letsboot Fork] Updated internal secret for ${key}.`)
	} catch (secretError) {
		console.error(`[Letsboot Fork] Failed to update internal secret for ${key}:`, secretError)
		vscode.window.showErrorMessage(`[Letsboot Fork] Failed to update internal secret for "${key}".`)
	}

	// Only update settings.json if this key already exists in overwriteSecrets
	if (Object.prototype.hasOwnProperty.call(currentOverwriteSecrets, key)) {
		try {
			// Create the updated object with only the existing keys
			const newSecrets = { ...currentOverwriteSecrets, [key]: value }

			// Update settings.json
			await config.update("overwriteSecrets", newSecrets, vscode.ConfigurationTarget.Global)
			console.log(`[Letsboot Fork] Updated overwriteSecrets.${key} in settings.json.`)
		} catch (error) {
			console.error(`[Letsboot Fork] Failed to update overwriteSecrets.${key} in settings.json:`, error)
			// Don't show error message to user since internal secret was updated successfully
		}
	} else {
		console.log(`[Letsboot Fork] Key ${key} not found in overwriteSecrets, skipping settings.json update.`)
	}
}
