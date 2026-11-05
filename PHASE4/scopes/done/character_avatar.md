# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
I have updated character image_data column (store base64 image):
1. Update that game.html , show avatar of character. (player only can upload their avatar by click to .div.avatar)

2. Update admin.html, admin could upload avatar of character

Image upload will store in image_data base64.


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Players can upload and view their avatar from the game sidebar; uploads are limited to their own character.
- Admins can upload and preview character avatars in the character editor.
- The server validates PNG, JPEG, GIF, and WebP uploads (up to 5 MB), stores image bytes in `characters.image_data`, and returns data URLs for display.
- JavaScript syntax checks and Prisma validation passed. Tester smoke checks passed; no database records were changed.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.