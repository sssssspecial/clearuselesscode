import * as vscode from 'vscode';

//Set a main function
export function activate(context: vscode.ExtensionContext) {
	//Set main command to remove trash and register this command in pakage.json
    let disposableRemoveUnusedCode = vscode.commands.registerCommand('clearcode.removeUnusedCode', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            removeUnusedCode(editor);
        }
    });

    context.subscriptions.push(disposableRemoveUnusedCode); 
}

export function deactivate() {}


function removeUnusedCode(editor: vscode.TextEditor) {
    const document = editor.document; //Geting a active file
    const text = document.getText(); //Write whis file in to text

    //Set the types of variables to be deleted
    const variablePattern = /\b(?:int|float|double|char|short|long|bool|string|std::string|auto)\s+(\w+)(\s*=[^;]+)?\s*;/g;
    const functionPattern = /\b(?:void|int|float|double|char|bool|string|auto)\s+(\w+)\s*\([^)]*\)\s*\{/g;

    const identifierUsagePattern = /\b(\w+)\b/g;
	//Set a map to find all func/val
    const declaredIdentifiers = new Map<string, vscode.Range>(); 

    let match: RegExpExecArray | null;
	//Read file and write all variables in map
    while ((match = variablePattern.exec(text)) !== null) {
        const identifier = match[1];
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
		//Write variables name in to map
        declaredIdentifiers.set(identifier, new vscode.Range(startPos, endPos));
    }	
    //Read file to find all functions
    while ((match = functionPattern.exec(text)) !== null) {
        const identifier = match[1];
        const startPos = document.positionAt(match.index);

        
        const functionBodyStartIndex = match.index + match[0].length - 1; 
        let braceCount = 1;
        let i = functionBodyStartIndex;
        while (braceCount > 0 && i < text.length) {
            i++;
            if (text[i] === '{') braceCount++;
            else if (text[i] === '}') braceCount--;
        }
        const endPos = document.positionAt(i + 1);
		//Write function name and all what this function contains in map
        declaredIdentifiers.set(identifier, new vscode.Range(startPos, endPos));
    }

    //Set map to count how many times func/var used
    const identifierCounts = new Map<string, number>();
    while ((match = identifierUsagePattern.exec(text)) !== null) {
        const identifier = match[1];
        if (declaredIdentifiers.has(identifier)) {
            const count = identifierCounts.get(identifier) || 0;
            identifierCounts.set(identifier, count + 1);
        }
    }

    //Set container to write all unused func/vars
    const unusedIdentifiers: { identifier: string; range: vscode.Range }[] = [];

    
    for (const [identifier, count] of identifierCounts) {
        if (count === 1 && identifier != 'main' ) {  //ignoring 'int main () {}'
            const range = declaredIdentifiers.get(identifier);
            if (range) {
                unusedIdentifiers.push({ identifier, range });
            }
        }
    }
	//Check if we have any unused things
    if (unusedIdentifiers.length > 0) {
		//Send a notification to user (me) if something in container
        vscode.window.showInformationMessage(`Found ${unusedIdentifiers.length} unused identifiers. Remove it?`, 'Yes', 'No')
            .then(answer => {  //check answer
                if (answer === 'Yes') {
                    
                    unusedIdentifiers.sort((a, b) => {
                        return b.range.start.compareTo(a.range.start);
                    });

                    //Set array for write from unused things only individuality to avoid the error 
                    const nonOverlappingRanges: vscode.Range[] = [];
                    for (const unused of unusedIdentifiers) {
                        let overlap = false;
                        for (const range of nonOverlappingRanges) {
                            if (unused.range.intersection(range)) {
                                overlap = true;
                                break;
                            }
                        }
						//If all good, write unused func/var in to new array
                        if (!overlap) {
                            nonOverlappingRanges.push(unused.range);
                        }
                    }
					//Removing all trash 
                    editor.edit(editBuilder => {
                        for (const range of nonOverlappingRanges) {
                            editBuilder.delete(range);
                        }
                    }).then(success => {
                        if (success) {
                            vscode.window.showInformationMessage('Unused identifiers removed.'); //Send another notification
                        }
                    });
                }
            });
    } else {
        vscode.window.showInformationMessage('Unused identifiers doesn`t found'); //And if we haven't also sent a notification
    }
}

