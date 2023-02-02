require('dotenv').config();

const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const date = require(__dirname + "/date.js")
const moment = require("moment");
const port = process.env.PORT || 3000;
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs')

const session = require('express-session');
const createSessionConfig = require("./session.js")

const sessionConfig = createSessionConfig();


const app = express();

app.use(cookieParser())
app.use(flash());

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.moment = moment;


mongoose.connect("mongodb://localhost:27017/user-todoDB", {useNewUrlParser: true, useUnifiedTopology: true});

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

const itemsSchema = ({  // Mongoose Schema
  name: String
});

const Item = mongoose.model("Item", itemsSchema);   // Mongoose Model

const item1 = new Item ({
  name: false
})

const defaultItems = [item1]


const listSchema = {
  name: String,
  items: [itemsSchema],
  time: Date
}

const List = mongoose.model("List", listSchema)

const userSchema = new mongoose.Schema ({   //format introduced as a requirement of mongoose-encryption
  email: String,
  password: String,
  name: String
})

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy());

passport.serializeUser(function(user, done){
  done(null, user.id)
});

passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.use( async function(req, res, next) {
  const user = req.session.user
  const isAuth = req.session.isAuthenticated;
//locals allows you to set some global values, any values of your choice that would be available all through the req n res cycle


  if (!user || !isAuth) {
    return next();  // The request for which this middleware is executed, should be forwarded to the next middleware or route in line. i.e demoRoutes
  }

  const userDoc = await User.findOne({_id: user.id})
  const isAdmin = userDoc.isAdmin;

  res.locals.isAuth = isAuth
  res.locals.isAdmin = isAdmin

  next();
})


app.get("/home", function(req, res){

  if(req.isAuthenticated()) {
    Item.find({}, function(err, foundItems) {

      if (foundItems.length === false){
          Item.insertMany(defaultItems, function(err){
             if(err){
               console.log(err);
             }else if (defaultItems[0].name === false) {
               console.log("!true");
             } else {
               console.log("Successfully loaded false elements");
             }
           })
           res.redirect("/home")

      } else {
        res.render("list", {listTitle: "Today", newListItems: foundItems})
      }
    })
  } else {
    res.redirect("/")
  }


});

app.get("/home/:customListName", (req, res) => { //dynamic website routing
  const trimmedCustomListName = req.params.customListName.trim()
  const customListName = _.capitalize(trimmedCustomListName);

   List.findOne({name: customListName}, function(err, foundLists){
     if(!err){
       if(!foundLists){

         const list = new List({
           //Create a new list
           name: customListName,
           time: date.getDate()
         })

         list.save();

         res.redirect("/home/" + customListName)

       } else {
         res.render("list", {listTitle: foundLists.name, newListItems: foundLists.items})
       }
     }
   })
})

// app.get("/list/:userId", function(req, res) {
//   const yourId = req.params.userId
//
//   // User.findOne({username: yourId}, function(err, foundUserId){
//   //
//   // })
// })


app.get("/home/saved-pages/all", function(req, res){

   List.find({}, function(err, docs) {

     if(!err) {
        res.render("paged", {listTitle: docs})
     }
     else {
        console.log(err);
     }

 });

})

app.get("/", function(req, res){
  res.render("entry")
})

app.get("/signup", function(req, res){
  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      email: '',
      confirmEmail: '',
      password: ''
    };
  }

  req.session.inputData = null;  //to delete the above session data after being used

  res.render('register', { inputData : sessionInputData});
})

app.get("/login", function(req, res){

  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      email: '',
      password: ''
    };
  }

  req.session.inputData = null;

  res.render('login', { inputData : sessionInputData});
})

app.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.post("/home/customPage", function(req, res){
  const customMade = req.body.myCustom;

res.redirect("/home/"+ customMade)
})


app.post("/home", function(req, res){

  const itemName = _.capitalize(req.body.newItem);
  const listName = req.body.list;

  const item = new Item({
    name: itemName
  })


  if(listName === "Today"){
    item.save();  // displays in mongo shell
    res.redirect("/home") // displays on server page
  } else {
    List.findOne({name: listName}, function(err, foundList) {
      foundList.items.push(item)
      foundList.save();
      res.redirect("/home/" + listName)
    })
  }
});

app.post("/delete", function(req, res){
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  if (listName === "Today"){
    Item.findByIdAndRemove(checkedItemId, function(err){
      if(!err){
        console.log("Successfully deleted checked item");
        res.redirect("/home")
      }
    })
  } else {
    List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedItemId}}}, function(err, foundList){
      if (!err) {
        res.redirect("/home/" + listName);
      }
    })
  }
})

app.post("/clear", function(req, res){
  // const checkedCheck = req.body.newCheck
  const clickedButton = req.body.delButton

  List.deleteOne({_id: clickedButton}, function(err){
  if(err){
    console.log(err);
  } else{
    console.log("Successfully deleted selected records");
    res.redirect("/home/saved-pages/all")
  }
});
})

app.post("/signup", async function(req, res){

  const userData = req.body;
  const enteredEmail = userData.username;
  const enteredConfirmEmail = userData['confirm-email'];  // [] because of the presence of a forbidden character
  const enteredPassword = userData.password;

  if (
    !enteredEmail ||
    !enteredConfirmEmail ||
    !enteredPassword ||
    enteredPassword.trim() < 6 ||
    enteredEmail !== enteredConfirmEmail ||
    !enteredEmail.includes('@')

  ) {
    req.session.inputData = {
      hasError: true,
      message: 'Invalid input- Please check your data.',
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      password: enteredPassword
    };

    req.session.save(function() {  // save the session before it gets redirected
      res.redirect('/signup')
    });
    return;  // to prevent crashing, i.e Cannot set headers after they are sent to the client
  }

  const existingUser = await User.findOne({username: enteredEmail});

  if(existingUser) {
    req.session.inputData = {  // when user already exists
      hasError: true,
      message: 'User exists already! Try logging in instead!',
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      password: enteredPassword
    };

    req.session.save(function (){
      res.redirect('/signup')
    })
    return;
  }


  User.register({username: enteredEmail}, enteredPassword , function(err, user){
    if(err){
      console.log(err);
      res.redirect("/signup")
    } else {
      passport.authenticate("local")(req, res, function(){
        req.flash('user', "Welcome, ", req.body.name)
        res.redirect("/login")
      })
    }
  })
})

app.post("/login", async function(req, res){

  const userData = req.body;
  const enteredEmail = userData.username;
  const enteredPassword = userData.password;

  const existingUser = await User.findOne({username: enteredEmail});

  if(!existingUser || !enteredEmail || !enteredPassword) {
    req.session.inputData = {  // when user could not log in
      hasError: true,
      message: 'Could not log you in- Please check your credentials.',
      email: enteredEmail,
      password: enteredPassword
    };

    req.session.save( function() {
      res.redirect('/login')
    })
    return;
  }

  // const passwordsAreEqual = await bcrypt.compareSync(
  //   enteredPassword, existingUser.password
  // )
  //
  // if(!passwordsAreEqual){
  //   req.session.inputData = {  // when user could not log in
  //     hasError: true,
  //     message: 'Could not log you in- Please check your credentials.',
  //     email: enteredEmail,
  //     password: enteredPassword
  //   };
  //   req.session.save( function() {
  //     res.redirect('/login')
  //   })
  //   return;
  // }


  const user = new User ({
    username: req.body.username,
    password: req.body.password
  })

  req.session.user = {id: existingUser._id, email: existingUser.username };

  req.login(user, function(err){
    if(err){
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        req.session.save(function() {
          res.redirect('/home') // only executes once the session has being saved to the DB, preventing it from a premature redirection
        })
      })
    }
  })
})

// app.post('/local-reg', passport.authenticate('local-signup', {
//   successRedirect: '/',
//   failureRedirect: '/signin'
//   })
// );



app.listen(port, function(){
  console.log(`Server has started Successfully`);
})
