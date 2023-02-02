require("dotenv").config();

const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const date = require(__dirname + "/date.js");
const moment = require("moment");
const port = process.env.PORT || 3000;
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const flash = require("connect-flash");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const session = require("express-session");
const createSessionConfig = require("./session.js");

const sessionConfig = createSessionConfig();

const app = express();

app.use(cookieParser());
app.use(flash());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.moment = moment;

mongoose.connect("mongodb://0.0.0.0:27017/user-todoDB-retry1", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

const itemsSchema = {
  // Mongoose Schema
  name: String,
};

const Item = mongoose.model("Item", itemsSchema); // Mongoose Model

const item1 = new Item({
  name: false,
});

const defaultItems = [item1];

const listSchema = {
  name: String,
  items: [itemsSchema],
  time: Date,
};

const List = mongoose.model("List", listSchema);

const userSchema = new mongoose.Schema({
  //format introduced as a requirement of mongoose-encryption
  email: String,
  password: String,
  name: String,
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

app.get("/home", function (req, res) {
  if (req.isAuthenticated()) {
    Item.find({}, function (err, foundItems) {
      if (foundItems.length === false) {
        Item.insertMany(defaultItems, function (err) {
          if (err) {
            console.log(err);
          } else if (defaultItems[0].name === false) {
            res.redirect("/home");
            console.log("!true");
          } else {
            res.redirect("/home");
            console.log("Successfully loaded false elements");
          }
        });
        res.redirect("/home");
      } else {
        res.render("list", { listTitle: "Today", newListItems: foundItems });
      }
    });
  } else {
    res.redirect("/");
  }
});

app.get("/home/:customListName", (req, res) => {
  //dynamic website routing
  const trimmedCustomListName = req.params.customListName.trim();
  const customListName = _.capitalize(trimmedCustomListName);

  List.findOne({ name: customListName }, function (err, foundLists) {
    if (!err) {
      if (!foundLists) {
        const list = new List({
          //Create a new list
          name: customListName,
          time: date.getDate(),
        });

        list.save();

        res.redirect("/home/" + customListName);
      } else {
        res.render("list", {
          listTitle: foundLists.name,
          newListItems: foundLists.items,
        });
      }
    }
  });
});

// app.get("/list/:userId", function(req, res) {
//   const yourId = req.params.userId
//
//   // User.findOne({username: yourId}, function(err, foundUserId){
//   //
//   // })
// })

app.get("/home/saved-pages/all", function (req, res) {
  List.find({}, function (err, docs) {
    if (!err) {
      res.render("paged", { listTitle: docs });
    } else {
      console.log(err);
    }
  });
});

app.get("/", function (req, res) {
  res.render("entry");
});

app.get("/entry", function (req, res) {
  res.render("entry");
});

app.get("/signup", function (req, res) {
  req.flash("user");
  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      email: "",
      confirmEmail: "",
      confirmName: "",
      password: "",
    };
  }

  req.session.inputData = null; //to delete the above session data after being used

  res.render("register", { inputData: sessionInputData });
});

app.get("/login", function (req, res) {
  req.flash("user");
  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      confirmName: "",
      password: "",
    };
  }

  req.session.inputData = null;

  res.render("login", { inputData: sessionInputData });
});

app.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post("/home/customPage", function (req, res) {
  const customMade = req.body.myCustom;

  res.redirect("/home/" + customMade);
});

app.post("/home", function (req, res) {
  const itemName = _.capitalize(req.body.newItem);
  const listName = req.body.list;

  const item = new Item({
    name: itemName,
  });

  if (listName === "Today") {
    item.save(); // displays in mongo shell
    res.redirect("/home"); // displays on server page
  } else {
    List.findOne({ name: listName }, function (err, foundList) {
      foundList.items.push(item);
      foundList.save();
      res.redirect("/home/" + listName);
    });
  }
});

app.post("/delete", function (req, res) {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  if (listName === "Today") {
    Item.findByIdAndRemove(checkedItemId, function (err) {
      if (!err) {
        console.log("Successfully deleted checked item");
        res.redirect("/home");
      }
    });
  } else {
    List.findOneAndUpdate(
      { name: listName },
      { $pull: { items: { _id: checkedItemId } } },
      function (err, foundList) {
        if (!err) {
          res.redirect("/home/" + listName);
        }
      }
    );
  }
});

app.post("/clear", function (req, res) {
  // const checkedCheck = req.body.newCheck
  const clickedButton = req.body.delButton;

  List.deleteOne({ _id: clickedButton }, function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log("Successfully deleted selected records");
      res.redirect("/home/saved-pages/all");
    }
  });
});

app.post("/signup", async function (req, res) {
  const userData = req.body;
  const enteredEmail = userData.email;
  const enteredConfirmEmail = userData["confirm-email"]; // [] because of the presence of a forbidden character
  const enteredNameOfUser = userData.username;
  const enteredPassword = userData.password;

  if (
    !enteredEmail ||
    !enteredConfirmEmail ||
    !enteredPassword ||
    !enteredNameOfUser ||
    enteredPassword.trim() < 8 ||
    enteredNameOfUser.trim() < 5 ||
    enteredNameOfUser.trim() > 10 ||
    enteredEmail !== enteredConfirmEmail ||
    !enteredEmail.includes("@")
  ) {
    req.session.inputData = {
      hasError: true,
      message: "Invalid input- Please check your data.",
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      confirmName: enteredNameOfUser,
      password: enteredPassword,
    };

    req.session.save(function () {
      // save the session before it gets redirected
      res.redirect("/signup");
    });
    return; // to prevent crashing, i.e Cannot set headers after they are sent to the client
  }

  const existingUser = await User.findOne({ name: enteredEmail });

  if (existingUser) {
    req.session.inputData = {
      // when user already exists
      hasError: true,
      message: "User exists already! Try logging in instead!",
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      confirmName: enteredNameOfUser,
      password: enteredPassword,
    };

    req.session.save(function () {
      res.redirect("/signup");
    });
    return;
  }

  const existingUserName = await User.findOne({ username: enteredNameOfUser });

  if (existingUserName) {
    req.session.inputData = {
      // when username already exists
      hasError: true,
      message: "Username already exists, Make yours unique 😉 ",
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      confirmName: enteredNameOfUser,
      password: enteredPassword,
    };

    req.session.save(function () {
      res.redirect("/signup");
    });
    return;
  }

  var regularExpression = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[^\w\s]).{8,16}$/;

  if(regularExpression.test(enteredPassword) === false ) {
    req.session.inputData = {
      // when password doesn't fit condition
      hasError: true,
      message: "Your password must contain at least a number, a letter in uppercase, a letter in lowercase and a special character😕. ",
      email: enteredEmail,
      confirmEmail: enteredConfirmEmail,
      confirmName: enteredNameOfUser,
      password: enteredPassword,
    };

    req.session.save(function () {
      res.redirect("/signup");
    });
    return;
  }

  User.register(
    { username: enteredNameOfUser, name: enteredEmail },
    enteredPassword,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/signup");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/login");
        });
      }
    }
  );
});

app.post("/login", async function (req, res) {
  const userData = req.body;
  // const enteredNameOfUser = userData.yourName;
  const enteredNameOfUser = userData.username;
  const enteredPassword = userData.password;

  const existingUser = await User.findOne({ username: enteredNameOfUser });

  if (!enteredNameOfUser || !enteredPassword) {
    req.session.inputData = {
      // when user could not log in
      hasError: true,
      message: "🖊️ Please fill in all your details.",
      confirmName: enteredNameOfUser,
      password: enteredPassword,
    };

    req.session.save(function () {
      res.redirect("/login");
    });
    return;
  }

  if (!existingUser) {
    req.session.inputData = {
      // when user could not log in
      hasError: true,
      message: "User does not exist 🗙. Please proceed to register.",
      confirmName: enteredNameOfUser,
      password: enteredPassword,
    };

    req.session.save(function () {
      res.redirect("/login");
    });
    return;
  }

  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.session.user = { id: existingUser._id, username: existingUser.username };

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: req.flash(
          "user",
          (req.session.inputData = {
            // when user could not log in
            hasError: true,
            message: "Could not log you in- Incorrect Password 🙃.",
            confirmName: enteredNameOfUser,
            password: enteredPassword,
          })
        ),
      })(req, res, function () {
        req.session.save(function () {
          res.redirect("/home"); // only executes once the session has being saved to the DB, preventing it from a premature redirection
        });
      });
    }
  });
});

// app.post('/local-reg', passport.authenticate('local-signup', {
//   successRedirect: '/',
//   failureRedirect: '/signin'
//   })
// );

app.listen(port, function () {
  console.log(`Server has started Successfully`);
});
