// <letsboot fork>
import * as assert from "assert"
import * as vscode from "vscode"
import { applyStateOverridesOnStartup, updateOverriddenProperty, deepMerge } from "../storage/state-overwrite"

// Mock VSCode context for testing
class MockExtensionContext {
	private globalStateData: Map<string, any> = new Map()
	private workspaceStateData: Map<string, any> = new Map()
	private secretsData: Map<string, string> = new Map()

	globalState = {
		get: (key: string) => this.globalStateData.get(key),
		update: async (key: string, value: any) => {
			this.globalStateData.set(key, value)
		},
		keys: () => Array.from(this.globalStateData.keys()),
		setKeysForSync: () => {},
	}

	workspaceState = {
		get: (key: string) => this.workspaceStateData.get(key),
		update: async (key: string, value: any) => {
			this.workspaceStateData.set(key, value)
		},
		keys: () => Array.from(this.workspaceStateData.keys()),
		setKeysForSync: () => {},
	}

	secrets = {
		get: async (key: string) => this.secretsData.get(key),
		store: async (key: string, value: string) => {
			this.secretsData.set(key, value)
		},
		delete: async (key: string) => {
			this.secretsData.delete(key)
		},
		onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event,
	}
}

// Mock vscode.workspace.getConfiguration
const mockConfigurations: Map<string, any> = new Map()

const originalGetConfiguration = vscode.workspace.getConfiguration
function mockGetConfiguration(section?: string) {
	return {
		get: (key: string) => {
			const fullKey = section ? `${section}.${key}` : key
			return mockConfigurations.get(fullKey)
		},
		update: async (key: string, value: any, target: vscode.ConfigurationTarget) => {
			const fullKey = section ? `${section}.${key}` : key
			mockConfigurations.set(fullKey, value)
		},
	}
}

suite("State Overwrite Tests", () => {
	let context: MockExtensionContext

	setup(() => {
		context = new MockExtensionContext()
		mockConfigurations.clear()
		// Mock vscode.workspace.getConfiguration
		;(vscode.workspace as any).getConfiguration = mockGetConfiguration
	})

	teardown(() => {
		// Restore original function
		;(vscode.workspace as any).getConfiguration = originalGetConfiguration
	})

	test("deepMerge should merge objects recursively", () => {
		const target = {
			apiConfiguration: {
				apiProvider: "anthropic",
				apiKey: "existing-key",
			},
			someOtherProperty: "existing",
		}

		const source = {
			apiConfiguration: {
				apiProvider: "openrouter",
				openRouterApiKey: "new-key",
			},
			newProperty: "new",
		}

		const result = deepMerge(target, source)

		assert.strictEqual(result.apiConfiguration.apiProvider, "openrouter")
		assert.strictEqual(result.apiConfiguration.apiKey, "existing-key")
		assert.strictEqual(result.apiConfiguration.openRouterApiKey, "new-key")
		assert.strictEqual(result.someOtherProperty, "existing")
		assert.strictEqual(result.newProperty, "new")
	})

	test("applyStateOverridesOnStartup should apply overrides from settings", async () => {
		// Set up mock configuration
		mockConfigurations.set("cline.overwriteState", {
			apiProvider: "openrouter",
			openRouterApiKey: "test-key",
			autoApprovalSettings: {
				enabled: true,
				maxRequests: 50,
			},
		})

		// Set up existing state
		await context.globalState.update("autoApprovalSettings", {
			enabled: false,
			maxRequests: 10,
			version: 1,
		})

		await context.workspaceState.update("apiProvider", "anthropic")

		// Apply overrides
		await applyStateOverridesOnStartup(context as any)

		// Check that overrides were applied
		assert.strictEqual(context.workspaceState.get("apiProvider"), "openrouter")

		// Check that nested objects were merged
		const autoApprovalSettings = context.globalState.get("autoApprovalSettings")
		assert.strictEqual(autoApprovalSettings.enabled, true)
		assert.strictEqual(autoApprovalSettings.maxRequests, 50)
		assert.strictEqual(autoApprovalSettings.version, 1) // Should preserve existing properties
	})

	test("updateOverriddenProperty should update settings.json for overridden properties", async () => {
		// Set up initial override state
		mockConfigurations.set("cline.overwriteState", {
			apiProvider: "openrouter",
			autoApprovalSettings: {
				enabled: true,
			},
		})

		// Update a property that was originally overridden
		await updateOverriddenProperty(context as any, "apiProvider", "anthropic")

		// Check that settings.json was updated
		const updatedOverwriteState = mockConfigurations.get("cline.overwriteState")
		assert.strictEqual(updatedOverwriteState.apiProvider, "anthropic")
		assert.strictEqual(updatedOverwriteState.autoApprovalSettings.enabled, true) // Should preserve other overrides
	})

	test("updateOverriddenProperty should not update settings.json for non-overridden properties", async () => {
		// Set up initial override state (without the property we'll try to update)
		mockConfigurations.set("cline.overwriteState", {
			apiProvider: "openrouter",
		})

		// Try to update a property that was NOT originally overridden
		await updateOverriddenProperty(context as any, "someOtherProperty", "new-value")

		// Check that settings.json was NOT updated for this property
		const overwriteState = mockConfigurations.get("cline.overwriteState")
		assert.strictEqual(overwriteState.apiProvider, "openrouter") // Should still be there
		assert.strictEqual(overwriteState.someOtherProperty, undefined) // Should not be added
	})

	test("should handle nested property updates correctly", async () => {
		// Set up initial override state with nested object
		mockConfigurations.set("cline.overwriteState", {
			apiConfiguration: {
				apiProvider: "openrouter",
				openRouterApiKey: "test-key",
			},
		})

		// Update a nested property
		await updateOverriddenProperty(context as any, "apiConfiguration", {
			apiProvider: "anthropic",
			openRouterApiKey: "test-key",
			apiKey: "new-anthropic-key",
		})

		// Check that the nested object was updated correctly
		const overwriteState = mockConfigurations.get("cline.overwriteState")
		assert.strictEqual(overwriteState.apiConfiguration.apiProvider, "anthropic")
		assert.strictEqual(overwriteState.apiConfiguration.openRouterApiKey, "test-key")
		assert.strictEqual(overwriteState.apiConfiguration.apiKey, "new-anthropic-key")
	})
})
// </letsboot fork>
