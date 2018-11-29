// Set options as a parameter, environment variable, or rc file.
require = require("esm")(module/*, options*/)
const fetch = require('node-fetch');
const express = require('express');
const { URLSearchParams } = require('url');
const PLAYER = 3;
const WALL = 2;
const BREADCRUMB = 4;
const EMPTY = 1;
const UNKNOWN = 0;
const END = 5;

// var port = process.env.PORT || 8080;
//
// var app = express();
//
// app.listen(port);
main();
// console.log('Server started! At http://localhost:' + port);

async function main(){
  let token = await getToken();
  traverseMaze(token);
}

function getToken(){
  const init = {
    method: 'POST',
    body: 'uid=504969404',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  return fetch('http://ec2-34-216-8-43.us-west-2.compute.amazonaws.com/session', init)
  .then((res) => {
    return res.json()
  })
  .then((json) => {
    return json.token
  });
}

async function traverseMaze(token){
  console.log('Using token: ' + token);
  let finished = false;
  let levelNum = 0;
  let canContinue = true;
  while(!finished && canContinue){
    canContinue = false;
    let {maze_size, current_location, status} = await getMazeState(token)
    if(status === 'FINISHED'){
      console.log("El fin.");
      return 1;
    }
    console.log("STARTING NEW MAZE at position: " + current_location + ' OF SIZE: ' + maze_size)
    let maze = initMaze(maze_size[0], maze_size[1], current_location);
    printMaze(maze);
    let levelSolved = false;
    let stack = [];
    newPosition(current_location, stack, maze, token).then(function(result){
      if(result === 'END'){
        traverseMaze(token).then(function(result){
          if(result == 1){
            return 1;
          }
        });
      }
      canContinue = true;
    });
  }
}

function getMazeState(token){
  return fetch(`http://ec2-34-216-8-43.us-west-2.compute.amazonaws.com/game?token=${token}`, {
    method: 'GET',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  }).then((res) => {
    return res.json();
  })
}

function initMaze(xSize, ySize, startingPos = null){
  if(xSize < 1 || ySize < 1){
    console.error('Maze Dimension invalid!');
    process.exit(1);
  }
  let maze = new Array(ySize);
  for(let i = 0; i < ySize; i++){
    maze[i] = new Array(xSize);
    for(let j = 0; j < xSize; j++){
      maze[i][j] = UNKNOWN;
    }
  }
  let mazeObj = {state: maze,
                  width: xSize,
                  height: ySize}
  if(inBounds(startingPos, mazeObj)){
    updateMazeAtPositionWith(mazeObj, startingPos, PLAYER);
  }
  else{
    console.error("STARTING POSITION NOT IN BOUNDS!");
    process.exit(2);
  }
  return mazeObj;
}

function inBounds(pos, maze){
  if(pos[0] > -1 && pos[0] < maze.width){
    if(pos[1] > -1 && pos[1] < maze.height){
      return true;
    }
  }
  return false;
}

function validMove(move){
  switch(move){
    case 'UP':
    case 'DOWN':
    case 'LEFT':
    case 'RIGHT':
      return true;
    default:
      return false;
  }
}

function opposite(move){
  switch(move){
    case 'UP':
      return 'DOWN';
    case 'DOWN':
      return 'UP';
    case 'LEFT':
      return 'RIGHT';
    case 'RIGHT':
      return 'LEFT';
    default:
      console.error("Cannot get opposite of invalid move: " + move);
      process.exit(2);
  }
}

function positionAfterMove(oldPosition, move){
  switch(move){
    case 'UP':
      return [oldPosition[0], oldPosition[1] - 1];
    case 'DOWN':
      return [oldPosition[0], oldPosition[1] + 1];
    case 'LEFT':
      return [oldPosition[0] - 1, oldPosition[1]];
    case 'RIGHT':
      return [oldPosition[0] + 1, oldPosition[1]];
  }
}

function updateMazeAtPositionWith(maze, position, object){
  maze.state[position[1]][position[0]] = object;
}

function attemptMove(move, token = null){
  if(token == null){
    console.error('TOKEN NOT PASSED');
    process.exit(2);
  }
  if(!validMove(move)){
    console.error(`Invalid move specified: ${move}`);
    process.exit(2);
  }
  const init = {
    method: 'POST',
    body: `action=${move}`,
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  }
  return fetch(`http://ec2-34-216-8-43.us-west-2.compute.amazonaws.com/game?token=${token}`, init)
  .then((res) => {
    return res.json();
  }).then((json) => {
    return json.result
  })
}

function updateMazeFromMoveResult(oldPosition, move, moveResult, maze){
  let newPosition = positionAfterMove(oldPosition, move);
  switch(moveResult){
    case 'SUCCESS':
      if(maze.state[oldPosition[1]][oldPosition[0]] != BREADCRUMB){
        updateMazeAtPositionWith(maze, oldPosition, EMPTY);
      }
      updateMazeAtPositionWith(maze, newPosition, PLAYER);
      break;
    case 'WALL':
      updateMazeAtPositionWith(maze, newPosition, WALL);
      break;
    case 'END':
      updateMazeAtPositionWith(maze, newPosition, END);
    case 'EXPIRED':
      console.log("SESSION EXPIRED.");
      process.exit(2);
    case 'OUT_OF_BOUNDS':
      console.error("WENT OUT OF BOUNDS GOING " + move);
      process.exit(2);
    default:
      console.error("UNRECOGNIZED MOVE RESULT: " + moveResult);
  }
}

function shouldMoveTo(position, maze){
  // console.log("SHOULD I MOVE TO: " + position);
  // console.log(maze.state[position[0]]);
  // console.log(maze.state[position[1]][position[0]]);
  if(maze == undefined || maze.state == undefined){
    console.log("MAZE UNDEFINED.");
    process.exit(2);
  }
  else if(position == undefined){
    console.log("POSITION UNDEFINED")
    process.exit(2);
  }
  if(!inBounds(position, maze)){
    // console.log("no.");
    return false;
  }
  else if(maze.state[position[1]][position[0]] == UNKNOWN){
    // console.log("yes.");
    return true;
  }
  // console.log("no.");
  return false;
}


async function newPosition(position, stack, maze, token){
  directionsToMove = ['RIGHT', 'DOWN', 'LEFT', 'UP'];
  // move in all directions possible first
  for(let direction of directionsToMove){
    if(shouldMoveTo(positionAfterMove(position, direction), maze)){
      let result = await attemptMove(direction, token);
      if(result == 'END'){
        return result
      }
      else{
        updateMazeFromMoveResult(position, direction, result, maze);
        printMaze(maze);
        if(result === 'SUCCESS'){
          stack.push(direction);
          let status = await newPosition(positionAfterMove(position, direction), stack, maze, token)
          if(status == 'END'){
            return status;
          }
        }
      }
    }
  }
  // now, backtrack
  if(stack.length <= 0){
    console.log("Nothing on stack to pop!");
    printMaze(maze);
  }
  let moveToReverse = stack.pop();
  let attemptedMove = opposite(moveToReverse);
  updateMazeAtPositionWith(maze, position, BREADCRUMB);
  printMaze(maze);
  let backtrackResult = await attemptMove(attemptedMove, token);
  if(backtrackResult == 'SUCCESS'){
    updateMazeFromMoveResult(position, attemptedMove, backtrackResult, maze);
  }
  else{
    console.error("Houston, we have a problem!");
  }
}

function printMaze(maze){
  console.log('START MAZE of size: ' + maze.width + ' ' + maze.height);
  console.log('---------------');
  for(let i = 0; i < maze.height; i++){
    let string = '';
    for(let j = 0; j < maze.width; j++){
      switch(maze.state[i][j]){
        // Unknown Element
        case UNKNOWN:
          string = string.padEnd(string.length + 1, '?');
          break;
        // Empty Space in the Maze
        case EMPTY:
          string = string.padEnd(string.length + 1, ' ');
          break;
        // Wall
        case WALL:
          string = string.padEnd(string.length + 1, '*');
          break;
        // Player
        case PLAYER:
          string = string.padEnd(string.length + 1, '@');
          break;
        case BREADCRUMB:
          string = string.padEnd(string.length + 1, 'V');
          break;
        case END:
          string = string.padEnd(string.length + 1, 'E');
          break;
        default:
          console.error('Maze Corruption Detected');
          process.exit(2);
      }
    }
    if(string !== ''){
      console.log(string);
    }
  }
  console.log('---------------');
  console.log('END MAZE');
}
