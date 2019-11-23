//todo: split logic and presentation is it worth it??

const ls = window.localStorage
let data= {
    playAudio:true,
    showmenu: true,
    menu: 'newgame',
    canResume: false,
    canReset: false,
    databoard: Array(81).fill(0),
    begin:[],
    undoList:[],
    notes: Array(81).fill( new Set() ),
    undoIndex:0,
    selected:null,
    annotate:false,
    focused:null,
    seed:637485, //start with fixed value
    startTime:null,
    pausedTime:null,
    finishedTime:null,
    helpAllowed:true,
    digitFirst:true,
}


//watch and save every property in app.data
let watch={}
for (let prop of Object.keys(data))
    watch[prop] = function(after, before){
        if (prop == "databoard" || prop == "notes"){
            let arrset = after.map( (x)=> (this.isValid(x) ? x : Array.from(x) ) )
            ls[prop] = JSON.stringify(arrset)            
        }else{
            ls[prop] = JSON.stringify(after)
        }
    };


var app=new Vue({
    el:"#sudoku-game",
    data:data,
    created(){
        //TODO: save and load game
        for (let prop of Object.keys(this._data)){
            if (ls[prop]){
                console.log(prop + " : " + ls[prop] )
                this._data[prop] = JSON.parse(ls[prop])
            }
            if (prop == "databoard" || prop == "notes"){
                let arrset = this._data[prop].map( (x)=> (this.isValid(x) ? x : new Set(x) ) )
                this._data[prop] = arrset
            }
        }
    },
    methods: {
        group(n){return ( ~~(n/3)%3 + 3*(~~(n/27)))+1 } ,
        column(n){return n % 9+1} ,
        row(n){return ~~(n / 9)+1} ,
        // select(n){this.selected=n},
        resume(){if (this.canResume) this.showmenu=false } ,
        reset(){
            if (this.canReset){
                this.databoard= Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9]))
                for (let i =0;i<81;i++){
                    if (this.isValid(this.begin[i]))this.put(this.databoard, i, this.begin[i])
                }
                this.showmenu=false
            }
        },
        newGame:function (n){
            this.canResume=true;
            this.startTime=new Date() //TODO: implement pauses?
            this.selected=null;
            this.databoard=this.newBoard(n)
            this.begin=this.databoard.map( (x)=> (this.isValid(x) ? x : "" ) )
            this.showmenu=false
            this.finished=null
            this.menu='main'
        },
        endGame(){
            this.canResume=false;
            this.finished=new Date();
            this.selected=null;
            this.menu="newgame"
            this.showmenu=true
            //TODO: show time and offer to play again.
        },
        random(){
            this.seed = Math.abs(this.seed * 16807 % 2147483647);
            return (this.seed - 1) / 2147483646
        },
        isFull: function(n){return 9==this.databoard.reduce( (count,x)=>count+(x==n), 0); },
        play:function(e){
            let i = e.target.dataset.index
            if ( !this.isValid(this.begin[i]) ){ //didn't hit a default value
                let sel = this.selected
                let val = e.target.innerHTML.trim()
                if ( val == sel){ //there's a value, remove it
                    this.$set(this.databoard, i, "")
                    this.remove(this.databoard, i)
                }else if (val == '' ){ // cell is empty
                    if (this.put(this.databoard, i, sel, this.helpAllowed)){
                        this.$set(this.databoard, i, sel)
                        if (this.undoIndex != this.undoList.length){
                            this.undoList.splice(this.undoIndex, this.undoList.length)
                        }
                        this.undoList.push({value:sel, index:i})
                        this.undoIndex = this.undoList.length
                    }
                    this.canReset=true
                }else if (val != '' ){//there's other value there, switch it??                    
                }
            }
            if( this.isSolved(this.databoard) ){
                this.endGame()
            }
        },
        undo(){
            if (this.undoIndex>0){
                let undo = this.undoList[--this.undoIndex]
                if (undo && this.isValid(undo.value)){
                    this.$set(this.databoard, undo.index, "")
                    this.remove(this.databoard, undo.index)
                }
            }
        },
        redo(){
            if ( this.undoIndex != this.undoList.length){
                let redo = this.undoList[this.undoIndex++]
                if (redo && this.isValid(redo.value)){
                    this.$set(this.databoard, redo.index, redo.value)
                    this.put(this.databoard, redo.index, redo.value, this.helpAllowed)
                }
            }
        },
        put(board, index, value, helpAllowed){
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
        },
        remove(board, index){
	        let myBoard = Array.from({length: 81}, e => new Set([1,2,3,4,5,6,7,8,9]) )
	        for(let x = 0; x < board.length; x++) {
		        if( this.isValid(board[x]) && x != index ) this.put( myBoard, x, board[x] )
	        }
            Array.prototype.splice.apply(board, [0, myBoard.length].concat(myBoard));
        },
        pickOne(aset) {
            //Selects random item from set, delete it from the set and return it; like a random Array.pop()
	        let idx = ~~(this.random() * aset.size)
	        let value = [...aset][idx]
	        aset.delete(value)
	        return value
        },
        isSolvable(board){
            //true if all the empty tiles have at least one possible value;
            //Is a misnomer, as it doesn't guarantees that can actually be solved.
	        for (let i = 0; i < board.length; i++){
		        if (board[i] && board[i].size && board[i].size === 0) return false
	        }
	        return true
        },
        isSolved(board){
	        for (let i=0; i<board.length; i++){
		        if ( !this.isValid( board[i] )) return false
	        }
	        return true
        },
        isValid(n){
            if (typeof n === "object" ) return false;
            return /^[1-9]$/.test(''+n)
        },
        isItStillUnique(board){
            //TODO: rewrite the logic, as it is is not enough.
            // return true if it's "solvable" and at least 1 tile can be autofilled
            let maybe=false
	        for (let i = 0;i<81;i++){
                if (!this.isValid(board[i]) && board[i].size===0) return false //solvable?
		        if (!this.isValid(board[i]) && board[i].size===1) maybe=true;
	        }
            return maybe;
        },
        solve(someBoard){ //receive the board as parameter, we don't want to show how we put it together,
            //backtrack depth-first solver (return first solution)
            //console.log("solving")
            let board = someBoard.map( (x)=> (this.isValid(x) ? x : new Set(x) ) ), //2 level array clone 
                stack = [], //private undo stack
                selects = 0
	        while (!this.isSolved(board)){
                //keep putting numbers
		        while(this.isSolvable(board)) {
                    //get the number of possible values for each spot
                    //or 10 if the spot is filled (we'll select the min, solved can't be min)
			        let lengthsArray = board.map( (x)=> ( this.isValid(x) ? 10 : x.size ) )
                    //get the minimum number of possible values for each spot 
			        let min = lengthsArray.reduce((a, b) => {return Math.min(a, b)} )
                    //Where's the min?
			        let index = lengthsArray.indexOf(min)                  
                    if (min == 10 ){ //this is the most likely exit point
                        return board
                    }                    
                    if (min == 1){
                        //if there's only one value possible just put it in
                        this.put (board, index, [...board[index]][0])
			        }else{
                        //if there's more than one possible values, stack the state and pick one at random
				        let values = new Set( board[index] )
				        let myValue = this.pickOne( values )
                        let oldBoard = board.map( (x) => (this.isValid(x) ? x : new Set(x) ) )
				        stack.push( {index:index, values:values, board: oldBoard})
                        this.put (board, index, myValue)
                        selects++
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
		        let myValue = this.pickOne(undo.values)
                this.put (board, undo.index, myValue)
		        stack.push(undo)
	        }
            //console.log("Solved!")
	        return board
        },
        removeRandomOne(board){
            let candidates = new Set(board.map((val, idx) => { if ( this.isValid (val)) return idx } ))
            let index = this.pickOne(candidates)
            this.remove(board, index)
        },
        newBoard(n){
            //start with a filled (solved) board 
            let board = this.solve( Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9] )) )
            let removed = 0
            let target = n;
            let tries = 1;
            while (tries && (removed <= target) ){
                let oldBoard = board.map( (x)=>{ return (this.isValid (x) ? x : new Set(x) ) })
                //then remove at random
                this.removeRandomOne(board);
                removed++;
                //TODO: keep it auto solvable
                if ( !this.isItStillUnique (board)){
                    board = oldBoard
                    removed--;
                    tries--;
                }
            }
            return board
        },
        showHint(board){
            //TODO: vuetify this
            let solvable = true;
            let index = undefined
            for (let i = 0;i<81;i++){
                if (!this.isValid(board[i]) && board[i].size===0) solvable=false //solvable?
		        if (!this.isValid(board[i]) && board[i].size===1) index=i;
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
    },
    watch: watch
})

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



