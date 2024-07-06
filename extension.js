const vscode = require("vscode");
const fs = require("fs");
const OPENAI = require("openai");
const sysprompt =
  "You should replace the code that you are sent, only following the comments. Do not talk at all. Only output valid code. Any comment that is asking you for something should be removed after you satisfy them. Other comments should left alone. Keep concise and use markdown, When asked to create code, only generate the code No bugs. Think step by step";

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  const isWorkspaceOpen = vscode.workspace.workspaceFolders?.length > 0;
  const llmFilename = "ask.md";

  if (!isWorkspaceOpen) {
    vscode.window.showErrorMessage("Please run this in an open workspace");
    return;
  }

  const llmfilePath = `${vscode.workspace.workspaceFolders[0].uri.fsPath}/${llmFilename}`;
  const doesllmFileExists = fs.existsSync(llmfilePath);

  if (!doesllmFileExists) {
    fs.writeFileSync(llmfilePath, "");
  }

  const regCommandFunction = async (replace = false) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const currActiveFilePath = editor.document.uri.fsPath;
    if (!currActiveFilePath.endsWith(llmFilename)) return;

    const config = vscode.workspace.getConfiguration("llmcodebuddy");
    console.log(config)

    if (!config || !config.openaikey) {
      vscode.window.showErrorMessage("please set your openai key");
      return;
    }
    await callAndStream(llmfilePath, editor, replace, config.openaikey);
  };

  const disposable = vscode.commands.registerCommand("llmcodebuddy.ask", () =>
    regCommandFunction()
  );

  const disposable2 = vscode.commands.registerCommand(
    "llmcodebuddy.replace",
    () => regCommandFunction(true)
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

async function callAndStream(llmfilePath, editor, replace, apiKey) {
  const openai = new OPENAI({
    apiKey,
  });

  await editor.document.save();
  const data = fs.readFileSync(llmfilePath);

  const userprompt = `You are a helpful assistant. What I have sent are my notes so far. You are very curt, yet helpful. \n${data.toString()}`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: sysprompt },
      {
        role: "user",
        content: userprompt,
      },
    ],
    stream: true,
  });

  if (replace) {
    await editor.edit((edit) => {
      edit.delete(editor.selection);
    });
  }

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    await editor.edit((edit) => {
      edit.insert(editor.selection.active, content);
    });
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
