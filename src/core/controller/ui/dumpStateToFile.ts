import { EmptyRequest, String as StringResponse } from "@shared/proto/cline/common"
import { GetWorkspacePathsRequest } from "@shared/proto/host/workspace"
import * as fs from "fs/promises"
import * as path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { Controller } from ".."

/**
 * Dumps the current extension state to a file in the workspace
 * @param controller The controller instance
 * @param request Empty request
 * @returns String response with success/error message
 */
export async function dumpStateToFile(controller: Controller, request: EmptyRequest): Promise<StringResponse> {
	try {
		// Get the current workspace paths
		const workspaceResponse = await HostProvider.workspace.getWorkspacePaths(GetWorkspacePathsRequest.create({}))

		if (!workspaceResponse.paths || workspaceResponse.paths.length === 0) {
			return StringResponse.create({
				value: "Error: No workspace folder is open. Please open a workspace to dump state.",
			})
		}

		// Get the current state that would be sent to webview
		const state = await controller.getStateToPostToWebview()

		// Create the dump file path in the first workspace folder
		const dumpFilePath = path.join(workspaceResponse.paths[0], ".state.dump.json")

		// Write the state to the file with pretty formatting
		await fs.writeFile(dumpFilePath, JSON.stringify(state, null, 2), "utf8")

		return StringResponse.create({
			value: `State successfully dumped to ${dumpFilePath}`,
		})
	} catch (error) {
		console.error("Error dumping state to file:", error)
		return StringResponse.create({
			value: `Error dumping state: ${error instanceof Error ? error.message : "Unknown error"}`,
		})
	}
}
