# Getting Started with Romulon Yield Aggregator

Feel free to watch the demo here: https://youtu.be/suprp_7RdgE
Things you will need: Code editor, Alchemy Account, Metamask account.
## How to use
Assuming you already have your favorite text editor installed:
First clone this repository to your code editor by hitting the clone button to the top right. After cloning and opening this project please run:

### `npm install`

This will install all the dependencies you need to run this project.

You will need an acount with Alchemy for this next part. 

After signing up at alchemy.com https://www.alchemy.com/ you can create  a porject. Create it on the mainnet, name it anything you like. Now once we have created a project there is an option called get keys. Click this and we will get a key to use.

We will take this key into our .env.example file. Paste ypur key where it asks and rename the .env.example. to just .env. This is a hidden file with sensitve information. Youu dont want to leave that key out for people to see.

Next we are going to run 
### `npx hardhat node`

This will allow us to run a local blockchain on a fork of the mainnet..

To test the code, please run npx hardhat test.

After ensuring all the tests are passing you can now run the project.

To start the dev server type

### `npm start`

Now we can interact with our react frontend. 

Since we ran our harhat node, we can actually use one of the accounts it generated to play with the application and not use any of our real ether. TO use the hardhat account go into the consoel where you ran the command hardhat node and look at the accounts. Grab the private key from any account and import it to your metamask.

Open metamask and click the 3 dots. Hit import account. Then import the private key. Awesome you did it. Now lets add the hardhat network to your metamask if its not already listed.

Clcikc the circle for your account in the top right. Click settings. Go to network. Go to add manually if hardhat isnt there. THen add this ass the name "http://127.0.0.1:8545/". Make the name hardhat and the chain id is 1337. 

Now we can finally interact with the app. Click connect wallet and connect the hardhat account. Then type in an amount and hit deposit. It will deposit it into the aave protocol. To withdraw your funds simply hit withdraw. 

IIf you want to rebalance your funds into theprotocol with better APY just hit rebalance and it will rebalance the funds accordingly.

And Thats all there is to it.A great way to maximize the amount you can earn with your crypto investments betwwenaave and compound protocol.
