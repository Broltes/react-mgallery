import React from 'react';
import { render } from 'react-dom';
import Gallery from 'react-mgallery';
import './app.less';

let imgs = [
    require('./img/1.jpg'),
    require('./img/2.jpg'),
    require('./img/3.jpg'),
    require('./img/4.jpg'),
];

var App = React.createClass({
    render: function(){
        return (
            <div>
                <Gallery imgs={imgs} currentIndex={1}
                    onLoading={() => console.log('loading')}
                    onLoaded={() => console.log('loaded')}/>
            </div>
        );
    }
});
render(<App/>, document.getElementById('app'));
