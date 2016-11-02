import React from 'react';
import { render } from 'react-dom';
import Gallery from 'react-mgallery';
import './app.less';

let imgs = [
    require('./img/1.jpg'),
    require('./img/2.jpg'),
    require('./img/3.jpg'),
    require('./img/4.jpg'),
    require('./img/5.jpg'),
    require('./img/1.jpg'),
    require('./img/2.jpg'),
    require('./img/3.jpg'),
    require('./img/4.jpg'),
    require('./img/5.jpg'),
];

var App = React.createClass({
    getInitialState() {
        return {
            currentIndex: 0
        }
    },
    onIndexChange(currentIndex) {
        this.setState({ currentIndex });
    },
    render: function(){
        const {
            state: { currentIndex },
            onIndexChange
        } = this;

        return (
            <div>
                <Gallery imgs={imgs} currentIndex={currentIndex}
                    onIndexChange={onIndexChange}
                    onLoading={() => console.log('loading')}
                    onLoaded={() => console.log('loaded')}>

                    <a className="btn">custom msg for {currentIndex}</a>
                </Gallery>
            </div>
        );
    }
});
render(<App/>, document.getElementById('app'));
