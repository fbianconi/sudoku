//todo: split logic and presentation is it worth it??

const ls = window.localStorage

var app=new Vue({
    el:"#sudoku-game",
    data:{
        showmenu: true,
        canResume: false,
        canReset: false,
        databoard: Array(81).fill(0),
        //Tile: {value:"", default:bool, possibles:Set, notes:Set, }
        /*Pros and cons of tile objects: reset is more complex, */
        begin:[],
        undoStack:[],
        selected:null,
        annotate:false,
        focused:null,
        seed:0,
        startTime:null,
        pausedTime:null,
        finishedTime:null,
        helpAllowed:true,
        digitFirst:true,
    },
    created(){
        if (ls.seed){
            this.seed=ls.seed
        }else{
            this.seed=~~(Math.random()*Number.MAX_SAFE_INTEGER)
        }
        if (ls.game){
            let game = JSON.parse(ls.game)
            this.databoard=game.databoard
            this.begin=game.begin
            this.undoStack=game.undoStack
        }
    },
    methods: {
        group(n){return ( ~~(n/3)%3 + 3*(~~(n/27)))+1 },
        column(n){return n % 9+1},
        row(n){return ~~(n / 9)+1},
        select(n){this.selected=n},
        isValid: isValid,
        resume(){if (this.canResume) this.showmenu=false },
        reset(){
            if (this.canReset){
                //oh! empty board... you're so full of possibilities...
                this.databoard= Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9]))
                for (let i =0;i<81;i++){
                    if (isValid(this.begin[i]))put(this.databoard, i, this.begin[i])
                }
                this.showmenu=false
            }
        },
        newGame:function (n){
            this.canResume=true;
            this.startTime=new Date() //TODO: implement pauses
            this.selected=null;
            this.databoard=newBoard(n)
            this.begin=this.databoard.map( (x)=> (isValid(x) ? x : "" ) )
            this.showmenu=false
            this.finished=null
            this.$refs.newGameSummary.click()
            
        },
        isFull: function(n){return 9==this.databoard.reduce( (count,x)=>count+(x==n), 0); },
        play:function(e){
            let i = e.target.dataset.index
            if ( !isValid(this.begin[i]) ){
                let sel = this.selected //TODO: stop highjacking for redraws
                this.selected=null
                if (e.target.innerHTML == sel){
                    remove(this.databoard, i)
                }else if (e.target.innerHTML != '' ){
                    remove(this.databoard, i)
                    put(this.databoard, i, sel, this.helpAllowed)
                    this.canReset=true
                }
                this.selected=sel
            }
        }
    },
    watch:{
        dataBoard: {
            deep:true,
        },
        seed(value){
            ls.seed=value;
        }
    }
})

function put(board, index, value, helpAllowed){
    //put a value to the board if the state admits it, or if help is disabled
    //tile should contain an array of possible values; or a number if it's been filled

    if (helpAllowed && (!board[index] || !board[index].has || !board[index].has(value))) return false;

    let col = index % 9
    let row = ~~(index / 9)
    let gc = ~~(col / 3)
    let gr = ~~(row / 3)

    for (let i = 0 ; i < 9 ; i++) {
        let c = i * 9 + col
        let r = row * 9 + i
        let gx = i % 3
        let gy = ~~(i / 3)
        let g = 3 * gc + gx + 27 * gr + 9 * gy  

        if (Set.prototype.isPrototypeOf( board[c] ) ) board[c].delete(value) 
        if (Set.prototype.isPrototypeOf( board[r] ) ) board[r].delete(value)
        if (Set.prototype.isPrototypeOf( board[g] ) ) board[g].delete(value)
    }
    
    board[index]=value;
    return true;
}

function remove(board, index){
	let myBoard = Array.from({length: 81}, e => new Set([1,2,3,4,5,6,7,8,9]) )
	for(let x = 0; x < board.length; x++) {
		if( isValid(board[x]) && x != index ) put( myBoard, x, board[x] )
	}
    Array.prototype.splice.apply(board, [0, myBoard.length].concat(myBoard));
}

function pickOne(aset) {
    //Selects random item from set, delete it from the set and return it; like a random Array.pop()
    let seed
	let idx = ~~(Math.random() * aset.size) //TODO: make it seedable
	let value = [...aset][idx]
	aset.delete(value)
	return value
}

function isSolvable(board){
    //true if all the empty tiles have at least one possible value;
    //Is a misnomer, as it doesn't guarantees that can actually be solved.
	for (let i = 0; i < board.length; i++){
		if (!isValid(board[i]) && board[i].size === 0) return false
	}
	return true
}

function isSolved(board){
	for (let i=0; i<board.length; i++){
		if ( !isValid( board[i] )) return false
	}
	return true
}

function isValid(n){return /^[1-9]$/.test(''+n)}

function isItStillUnique(board){
    // return true if it's "solvable" and at least 1 tile can be autofilled
    let maybe=false
	for (let i = 0;i<81;i++){
        if (!isValid(board[i]) && board[i].size===0) return false //solvable?
		if (!isValid(board[i]) && board[i].size===1) maybe=true;
	}
    return maybe;
}

function solve(someBoard){
    //backtrack depth-first solver (return first solution)
    //console.log("solving")
    let board = someBoard.map( (x)=> (isValid(x) ? x : new Set(x) ) ), //2 level array clone 
        stack = [] //private undo stack
	while (!isSolved(board)){
        //keep putting numbers
		while(isSolvable(board)) {
            //get the number of possible values for each spot or 10 if the spot is filled
			let lengthsArray = board.map( (x)=> ( isValid(x) ? 10 : x.size ) )
            //get the minimum number of possible values for each spot
			let min = lengthsArray.reduce((a, b) => {return Math.min(a, b)} )
            //Where's the min?
			let index = lengthsArray.indexOf(min)
            
            if (min == 10 ){
                //console.log("Solved!") //this is the most likely exit point
                return board
            }
            
            if (min == 1){
                //if there's only one value possible just put it in
                put (board, index, [...board[index]][0])
			}else{
                //if there's more than one possible values, stack the state and pick one at random
				let values = new Set( board[index] )
				let myValue = pickOne( values )
                let oldBoard = board.map( (x) => (isValid(x) ? x : new Set(x) ) )
				stack.push( {index:index, values:values, board: oldBoard})
                put (board, index, myValue)
			}
		}

        //we're in an invalid state; back to last choice
		do{
            var undo = stack.pop() //let it hoist
        }while(undo && undo.values.size==0) //unstack all the finished alternatives

        if (undo === undefined ) { //options exhausted
            //console.log("Can't be solved")
            return null
        }
        
        board = undo.board
		let myValue = pickOne(undo.values)
        put (board, undo.index, myValue)
		stack.push(undo)
	}
    //console.log("Solved!")
	return board
}

function removeRandomOne(board){
    let candidates = new Set(board.map((val, idx) => { if ( isValid (val)) return idx } ))
    let index = pickOne(candidates)
    remove(board, index)
}

function newBoard(n){
    //start with a filled board 
    let board = solve( Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9] )) )
    let removed = 0
    let target = n;
    let tries = 1;
    while (tries && (removed <= target) ){
        let oldBoard = board.map( (x)=>{ return (isValid (x) ? x : new Set(x) ) })
        //then remove at random
        removeRandomOne(board);
        removed++;
        //but keep it auto solvable
        if ( !isItStillUnique (board)){
            board = oldBoard
            removed--;
            tries--;
        }
    }
    return board
}

function showHint(){
    let board = app.$data.databoard;
    let solvable = true;
    let index = undefined
    console.log("hint clicked")
    for (let i = 0;i<81;i++){
        if (!isValid(board[i]) && board[i].size===0) solvable=false //solvable?
		if (!isValid(board[i]) && board[i].size===1) index=i;
	}
    if (!solvable){
        alert("Not solvable")
    }
    if (index >=0 ){
        let el = document.querySelector("[data-index='"+index+"']"); 
        el.classList.add("hint")
        window.setTimeout( () => el.classList.remove("hint"), 4000 )
        console.log("hint: ",index)
    }
}

/* Set the width of the side navigation to 250px and the left margin of the page content to 250px */
function openNav() {
    document.getElementById("sidenav").style.width = "250px";
    //document.getElementById("main").style.marginLeft = "250px";
}

/* Set the width of the side navigation to 0 and the left margin of the page content to 0 */
function closeNav() {
    document.getElementById("sidenav").style.width = "0";
    //document.getElementById("main").style.marginLeft = "0";
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('worker.js').then(function(registration) {
      // Registration was successful
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) {
      // registration failed :(
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}


