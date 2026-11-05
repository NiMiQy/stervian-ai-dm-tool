# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Make a shop.html only . I want UI/UX following style from game.html . 

On the left will be a avatar of shop keeper (leave it blank , manually add it).
On the right will be a category of shop. Item list , menu buying/selling.  

On tab buying: 
Player could choice quantity to buy
Make player could choice multiple item in cart first. Then finalize purchase. 

On tab selling:
Player could choice item , and quantity to sell.
Make player could choice multiple item in sell list . Then finalize sell.


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Added public/shop.html with game styling, a blank shopkeeper portrait, categories, and quantity-based buy/sell carts.
- Game shop navigation opens the page only from a shop or inn.
- Displays the current shop and owner NPC names from server data.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
