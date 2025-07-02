// letsboot fork - Dump State to File functionality
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { Controller } from ".."
import { EmptyRequest, String as ProtoString } from "../../../shared/proto/common"

/**
 * Dumps the current extension state to a file in the workspace
 * @param controller The controller instance
 * @param request Empty request
 * @returns String with success/error message
 */
export async function dumpStateToFile(controller: Controller, request: EmptyRequest): Promise<ProtoString> {
	try {
		const state = await controller.getStateToPostToWebview()
		const workspaceFolders = vscode.workspace.workspaceFolders

		if (workspaceFolders && workspaceFolders.length > 0) {
			const rootPath = workspaceFolders[0].uri.fsPath
			const filePath = path.join(rootPath, ".state.dump.json")
			await fs.writeFile(filePath, JSON.stringify(state, null, 2))

			vscode.window.showInformationMessage("Successfully dumped state to .state.dump.json")
			return ProtoString.create({ value: "Successfully dumped state to .state.dump.json" })
		} else {
			const errorMessage = "No workspace folder open to dump state file."
			vscode.window.showErrorMessage(errorMessage)
			return ProtoString.create({ value: errorMessage })
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const fullErrorMessage = `Failed to dump state: ${errorMessage}`
		vscode.window.showErrorMessage(fullErrorMessage)
		console.error("Failed to dump state:", error)
		return ProtoString.create({ value: fullErrorMessage })
	}
}
