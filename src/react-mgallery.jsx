import React from 'react';
import './style.less';

// 全屏视窗
let _viewSize = { w: window.innerWidth, h: window.innerHeight },
    _viewBasePoint = { x: _viewSize.w/2, y: _viewSize.h/2 };

let _items = {},
    _initialDistance,
    _initialScale,
    _initialScaleX,
    _initialScaleY,
    _initialCenterPoint,
    _lastCenterPoint;


// 计算两点间距
function _calculatePointsDistance(p1, p2) {
    let x0 = Math.abs(p1.x - p2.x);
    let y0 = Math.abs(p1.y - p2.y);

    return Math.round(Math.sqrt(x0*x0 + y0*y0));
}
function _calculateCenterPoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p1.y) / 2
    };
}
function _touchToPoint(touch) {
    return { x: touch.pageX, y: touch.pageY };
}
function _limit(min, val, max){
    return Math.max(min, Math.min(max, val));
}
// 计算图片缩放后的尺寸超出视窗边界
function _calculateBounds(destScale, item) {
    let delta = {
        x: (item.w * destScale - _viewSize.w) / 2,
        y: (item.h * destScale - _viewSize.h) / 2
    };

    // 计算缩放后拖拽边界
    return {
        minX: delta.x < 0 ? 0 : -delta.x,
        minY: delta.y < 0 ? 0 : -delta.y,
        maxX: delta.x < 0 ? 0 : delta.x,
        maxY: delta.y < 0 ? 0 : delta.y,
    };
}

export default React.createClass({
    getDefaultProps: function () {
        return {
            currentIndex: 0,
            maxScale: 2,
            minScale: 1,

            onLoading() {},
            onLoaded() {},
        };
    },
    getInitialState() {
        return {
            currentIndex: this.props.currentIndex || 0,
            lazyImgs: {},

            x0: 0,// x轴滑动偏移量
            scale: 1,
            scaleX: 0,
            scaleY: 0,

            transition: 0
        };
    },

    init(touches) {
        let p1 = _touchToPoint(touches[0]);
        const {scale, scaleX, scaleY} = this.state;

        if(touches.length > 1){
            let p2 = _touchToPoint(touches[1]);

            // 缓存两个触点间初始距离
            _initialDistance = _calculatePointsDistance(p1, p2);
            _initialCenterPoint = _calculateCenterPoint(p1, p2);
        } else {
            _initialCenterPoint = p1;
        }

        _initialScale = scale;
        _initialScaleX = scaleX;
        _initialScaleY = scaleY;
    },
    touchStart(e) {
        this.init(e.touches);
    },
    touchMove(e) {
        e.preventDefault();
        this.setState({ transition: 0 });

        let { touches } = e;
        let p1 = _lastCenterPoint = _touchToPoint(touches[0]);

        if(touches.length > 1) {
            // 缩放
            let p2 = _touchToPoint(touches[1]);
            let scale = _calculatePointsDistance(p1, p2) / _initialDistance;
            let destScale = scale * _initialScale;

            _lastCenterPoint = _calculateCenterPoint(p1, p2);
            this.applyScale(destScale);
        } else {
            // 滑动
            const { scale, currentIndex } = this.state;
            let scaleX = p1.x - _initialCenterPoint.x + _initialScaleX;
            let scaleY = p1.y - _initialCenterPoint.y + _initialScaleY;
            let bounds = _calculateBounds(scale, _items[currentIndex]);

            // 应用边界
            scaleX = _limit(bounds.minX, scaleX, bounds.maxX);
            scaleY = _limit(bounds.minY, scaleY, bounds.maxY);

            this.setState({ scaleX, scaleY });
        }
    },
    touchEnd(e) {
        this.setState({ transition: 1 });
        const { scale, currentIndex} = this.state;
        const { maxScale, minScale } = this.props;
        let { touches } = e;

        if(touches.length) {
            // 为剩下的触点重新初始化
            this.init(touches);
        } else {
            // 触摸结束
            let destScale = _limit(minScale, scale, maxScale);
            let bounds = _calculateBounds(destScale, _items[currentIndex])
            this.applyScale(destScale, bounds);
        }
    },

    applyScale(destScale, bounds) {
        // 计算缩放补偿量
        // 触摸中点移动距离 - 缩放导致的触摸中点偏移量
        let scale = destScale / _initialScale;// 相对缩放率，以触摸开始为1
        let scaleX = (_initialScaleX + _lastCenterPoint.x - _initialCenterPoint.x) * scale
            - (_lastCenterPoint.x - _viewBasePoint.x) * (scale - 1);
        let scaleY = (_initialScaleY + _lastCenterPoint.y - _initialCenterPoint.y) * scale
            - (_lastCenterPoint.y - _viewBasePoint.y) * (scale - 1);

        if(bounds) {
            // 应用边界
            scaleX = _limit(bounds.minX, scaleX, bounds.maxX);
            scaleY = _limit(bounds.minY, scaleY, bounds.maxY);
        }

        // 计算缩放
        this.setState({
            scale: destScale,
            scaleX,
            scaleY,
        });
    },

    preLoadImg() {
        const { currentIndex, lazyImgs } = this.state;
        let _lazyImgs = {};
        let nextIndex = Math.min(this.props.imgs.length - 1, currentIndex + 1);
        let prevIndex = Math.max(0, currentIndex - 1);

        _lazyImgs[currentIndex] = 1;
        _lazyImgs[prevIndex] = 1;
        _lazyImgs[nextIndex] = 1;

        this.setState({ lazyImgs: Object.assign({}, lazyImgs, _lazyImgs)});
    },
    imgLoaded(e, i) {
        if(_items[i]) return;
        if(i == this.state.currentIndex) this.props.onLoaded();

        // 记录图片初始尺寸
        let img = e.target;
        let { width, height } = img;
        _items[i] = {
            w: width,
            h: height
        }
    },
    render(){
        var { imgs } = this.props;
        var { currentIndex, lazyImgs, x0, scale, scaleX, scaleY, transition } = this.state;
        var { touchStart, touchMove, touchEnd, imgLoaded } = this;

        return (
            <div className="mgallery" ref="holder"
                onTouchStart={touchStart}
                onTouchMove={touchMove}
                onTouchEnd={touchEnd}>

                <div className={'mgallery-container' + (transition ? ' transition' : '')} style={{
                        width: `${imgs.length}02%`,
                        marginLeft: `-${currentIndex}01%`,
                        WebkitTransform: `translate3d(${x0}px,0,0)`
                    }}>

                    { imgs.map((img, i) => {
                        let item = _items[i];
                        let scalerStyle = (i == currentIndex) && item ? {
                            WebkitTransform: `translate3d(${scaleX}px,${scaleY}px,0) scale(${scale})`
                        } : null;

                        return (
                            <div key={i} className="mgallery-item">
                                <div className="mgallery-scaler" style={scalerStyle}>
                                    {lazyImgs[i] ? <img src={img} onLoad={(e) => imgLoaded(e, i)}/> : null}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mgallery-dots">
                    { imgs.length > 1 ? imgs.map(function(img, i) {
                        return <i key={i} className={currentIndex == i ? 'on' : ''}/>;
                    }) : null }
                </div>
            </div>
        );
    },

    componentWillMount() {
        this.preLoadImg();

        this.props.onLoading();
    }
});
