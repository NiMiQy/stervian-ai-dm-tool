# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Scope

Currently admin.html, some functional have already developed and work very well. But I have modified and updated database schema prisma.

- Check PRISMA.MD (schema structure)
- In admin.html, adjust client side, and server side, where create/edit/delete Player, NPC/Monster following schema.
- Add "Skills" tab next "Items" tab and make CRUD for Skills.
- Add "Effects" tab next to "Skills" tab and make CRUD for Effects.

Enhancement: in creation Player, NPC/Monster modal. 
- Add section Skills similar to other relationship section, but the pop up when edit fields is a grid view a list skills.
- Add section Effects similar to other relationship section, but the pop up when edit fields is a grid view a list effects.

## IMPORTANT:
- Do not change inrelavent files.
- The currently UX/UI layout for admin.html is working fine and correct, do not current delete layout, just add or adjust. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- Working CRUD function
- Updated correcting functions,logics on client side, layout.
- updated correcting functions,logics on server side.

## Implemented

- Added admin Skills and Effects tabs with create, edit, and soft-delete CRUD.
- Added server-side Skills/Effects loading, validation, and persistence.
- Added character Skills assignment through a grid selector.
- Added character active Effects assignment with duration turns.
- Updated character queries and admin APIs to include the new relations.
- Preserved the existing admin layout and workflow.
- Verified JavaScript syntax and Prisma schema validation.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.