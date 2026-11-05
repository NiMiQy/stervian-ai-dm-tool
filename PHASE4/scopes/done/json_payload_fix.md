# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, when player plays for long time, json payload error will appear and server will not response the player anymore, I want to fix this : 
 An error "DM Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
  1. Increase limit of JSON body on server-side to maximum 10mb.
  2. On client side, split the request json into small chunk. 1mb each.
  3. On server side, handle logic for request chunks. Asures that if 50-100 players send a same request, the server side still can handle smoothly.
  4. Testing cases.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Increased server JSON body limit to 10 MB.
- Added 1 MB client request chunking and server-side reassembly with concurrency limits and cleanup.
- Added JSON error responses for malformed or oversized requests.
- Added payload and concurrency tests; all 4 tests pass.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.